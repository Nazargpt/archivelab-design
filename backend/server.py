from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import uuid
import csv
import io
import base64
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
import requests
import httpx
import re
import ipaddress
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Form, Header, Query, Depends
from fastapi.responses import Response, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
APP_BASE_URL = os.environ.get('APP_BASE_URL', '').rstrip('/')
CURRENCY = os.environ.get('CURRENCY', 'ARS')
MP_ACCESS_TOKEN = os.environ.get('MP_ACCESS_TOKEN', '').strip()
MP_MODE = os.environ.get('MP_MODE', 'test')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "archivelab"

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "ARCHIVE LAB")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("archivelab")

app = FastAPI(title="ARCHIVE LAB API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Object storage
# ---------------------------------------------------------------------------
_storage_key = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt):
    return dt.isoformat()

def formatARS_py(n) -> str:
    return "$ " + f"{int(round(n or 0)):,}".replace(",", ".")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_jwt(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

async def get_optional_user(request: Request):
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    # Try JWT (email/password auth)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if user:
            user.pop("password_hash", None)
            return user
    except Exception:
        pass
    # Try Emergent session token (Google auth)
    session = await db.user_sessions.find_one({"session_token": token})
    if session:
        expires_at = session["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now_utc():
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
            if user:
                user.pop("password_hash", None)
                return user
    return None

async def require_user(request: Request):
    user = await get_optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    return user

async def require_admin(request: Request):
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso reservado a la administración")
    return user

# ---------------------------------------------------------------------------
# Email (Emergent-managed Resend) — guardrail gate copied as-is
# ---------------------------------------------------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.error("EMERGENT_EMAIL_KEY missing; skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                 headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None

def _email_shell(title: str, lines: list, cta_label: str = "", cta_url: str = "") -> str:
    inner = "".join(f'<p style="margin:0 0 14px;color:#3a3a3a;font-size:15px;line-height:1.6">{l}</p>' for l in lines)
    cta = ""
    if cta_label and cta_url:
        cta = (f'<p style="margin:22px 0"><a href="{escape(cta_url)}" style="background:#111;color:#fff;'
               f'text-decoration:none;padding:12px 24px;font-size:13px;letter-spacing:.12em;'
               f'text-transform:uppercase;display:inline-block">{escape(cta_label)}</a></p>')
    return (f'<table role="presentation" width="100%" style="background:#f6f5f2;padding:28px 0">'
            f'<tr><td align="center"><table role="presentation" width="520" style="background:#fff;'
            f'border:1px solid #e6e2dd"><tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif">'
            f'<p style="margin:0 0 20px;font-size:22px;font-weight:800;letter-spacing:-.02em">ARCHIVE <span style="font-style:italic;font-weight:400">lab</span></p>'
            f'<h1 style="margin:0 0 18px;font-size:20px;color:#111">{escape(title)}</h1>'
            f'{inner}{cta}'
            f'<p style="margin:26px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px">'
            f'Recibís este correo porque te anotaste en ARCHIVE LAB. Nunca te pedimos tu contraseña ni datos de tarjeta por email.</p>'
            f'</td></tr></table></td></tr></table>')


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class SessionIn(BaseModel):
    session_id: str

class SizeStock(BaseModel):
    label: str
    measurements: str = ""

class ProductIn(BaseModel):
    name: str
    design_code: str
    edition_name: str = ""
    edition_total: Optional[int] = None
    category: str  # denim | intima | accesorios | carteras
    vip: bool = False
    concept: str = ""
    interventions: str = ""
    materials: str = ""
    care: str = ""
    shipping_info: str = ""
    color: str = ""
    price: Optional[float] = None
    sizes: List[SizeStock] = []
    images: List[str] = []
    video: Optional[str] = None
    status: str = "draft"  # draft | published | archived

class UnitsGenerateIn(BaseModel):
    size: str
    color: str = ""
    quantity: int = 1

class UnitUpdateIn(BaseModel):
    status: str
    note: str = ""

class CheckoutItem(BaseModel):
    product_id: str
    size: str

class CheckoutIn(BaseModel):
    items: List[CheckoutItem]
    guest_email: Optional[EmailStr] = None
    guest_name: Optional[str] = None
    shipping_method: str = "envio"
    shipping_address: str = ""
    shipping_province: str = ""
    shipping_cost: float = 0
    carrier: str = ""

class SettingsIn(BaseModel):
    currency: str = "ARS"
    shipping_zones: List[dict] = []
    pickup_enabled: bool = True
    flat_cost: float = 0
    free_threshold: Optional[float] = None
    contact_email: str = ""
    contact_whatsapp: str = ""
    instagram: str = ""
    pinterest: str = ""
    address: str = ""

class CarrierCfg(BaseModel):
    enabled: bool = False
    credentials: dict = {}

class CarriersIn(BaseModel):
    andreani: CarrierCfg = CarrierCfg()
    oca: CarrierCfg = CarrierCfg()
    correo: CarrierCfg = CarrierCfg()

class QuoteIn(BaseModel):
    province: str = ""
    postal_code: str = ""
    subtotal: float = 0

class HomeContentIn(BaseModel):
    hero_title: str = ""
    hero_subtitle: str = ""
    hero_video: Optional[str] = None
    manifesto: str = ""
    creator_bio: str = ""

class LegalIn(BaseModel):
    privacy: str = ""
    terms: str = ""
    returns: str = ""

class EventIn(BaseModel):
    title: str
    type: str = "desfile"  # desfile | lanzamiento | exposicion | presentacion
    description: str = ""
    date: str = ""  # free text / ISO
    location: str = ""
    image: Optional[str] = None
    price: Optional[float] = None  # None = evento gratuito (anotarse)
    capacity: Optional[int] = None
    status: str = "draft"  # draft | published

class EventRegisterIn(BaseModel):
    name: str
    email: EmailStr

class ReleaseIn(BaseModel):
    title: str
    description: str = ""
    image: Optional[str] = None
    teaser_date: str = ""
    status: str = "draft"  # draft | published

class WaitlistIn(BaseModel):
    name: str
    email: EmailStr
    size: str = ""
    consent: bool = False

class ShippingIn(BaseModel):
    status: str = "enviado"  # pendiente | enviado | entregado
    carrier: str = ""
    tracking_number: str = ""
    tracking_url: str = ""

# ---------------------------------------------------------------------------
# Reservation maintenance
# ---------------------------------------------------------------------------
async def release_expired():
    now = now_utc()
    cursor = db.units.find({"status": "reservada"})
    async for u in cursor:
        ru = u.get("reserved_until")
        if not ru:
            continue
        if isinstance(ru, str):
            ru = datetime.fromisoformat(ru)
        if ru.tzinfo is None:
            ru = ru.replace(tzinfo=timezone.utc)
        if ru < now:
            order = await db.orders.find_one({"id": u.get("order_id")})
            if order and order.get("status") == "paid":
                continue
            await db.units.update_one({"id": u["id"]}, {"$set": {
                "status": "disponible", "order_id": None, "reserved_until": None},
                "$push": {"history": {"at": iso(now), "action": "reserva_expirada"}}})
            if order and order.get("status") == "created":
                await db.orders.update_one({"id": order["id"]}, {"$set": {"status": "expired"}})

async def availability_summary(product_id: str):
    """Returns per-size available counts and total available."""
    summary = {}
    total = 0
    cursor = db.units.find({"product_id": product_id, "status": "disponible"}, {"_id": 0})
    async for u in cursor:
        summary[u["size"]] = summary.get(u["size"], 0) + 1
        total += 1
    return summary, total


async def compute_shipping(province: str, subtotal: float) -> float:
    s = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
    ft = s.get("free_threshold")
    if ft is not None and subtotal >= float(ft):
        return 0.0
    for z in s.get("shipping_zones", []):
        if province and province in (z.get("provinces") or []):
            return float(z.get("cost", 0) or 0)
    return float(s.get("flat_cost", 0) or 0)

# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ese email ya está registrado")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {"id": user_id, "email": email, "name": body.name,
           "password_hash": hash_password(body.password), "role": "customer",
           "picture": None, "created_at": iso(now_utc())}
    await db.users.insert_one(doc)
    token = create_jwt(user_id, email)
    return {"token": token, "user": clean(dict(doc))}

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = create_jwt(user["id"], email)
    return {"token": token, "user": clean(dict(user))}

@api.post("/auth/session")
async def emergent_session(body: SessionIn):
    try:
        r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": body.session_id}, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception:
        raise HTTPException(status_code=401, detail="No se pudo validar la sesión de Google")
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {"id": user_id, "email": email, "name": data.get("name", email),
                "password_hash": None, "role": "customer",
                "picture": data.get("picture"), "created_at": iso(now_utc())}
        await db.users.insert_one(dict(user))
    else:
        if data.get("picture") and not user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": data["picture"]}})
            user["picture"] = data["picture"]
    session_token = data["session_token"]
    await db.user_sessions.insert_one({"user_id": user["id"], "session_token": session_token,
                                       "expires_at": iso(now_utc() + timedelta(days=7)),
                                       "created_at": iso(now_utc())})
    return {"token": session_token, "user": clean(dict(user))}

@api.get("/auth/me")
async def me(user=Depends(require_user)):
    return user

@api.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        await db.user_sessions.delete_many({"session_token": auth[7:]})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Public catalog
# ---------------------------------------------------------------------------
@api.get("/products")
async def list_products(category: Optional[str] = None, vip: Optional[bool] = None,
                        size: Optional[str] = None, availability: Optional[str] = None,
                        historic: Optional[bool] = None):
    await release_expired()
    if historic:
        items = []
        async for p in db.products.find({"status": {"$in": ["published", "archived"]}, "vip": {"$ne": True}}, {"_id": 0}).sort("created_at", -1):
            summary, total = await availability_summary(p["id"])
            is_sold_out = bool(p.get("edition_total")) and total <= 0
            if p.get("status") != "archived" and not is_sold_out:
                continue  # still available or a prototype -> not historic
            if category and p.get("category") != category:
                continue
            p["available_by_size"] = summary
            p["available_total"] = total
            p["historic"] = True
            items.append(p)
        return items
    q = {"status": "published"}
    if category:
        q["category"] = category
    if vip is not None:
        q["vip"] = vip
    items = []
    async for p in db.products.find(q, {"_id": 0}).sort("created_at", -1):
        summary, total = await availability_summary(p["id"])
        p["available_by_size"] = summary
        p["available_total"] = total
        if size and summary.get(size, 0) <= 0:
            continue
        if availability == "libre" and total <= 0:
            continue
        if availability == "agotado" and total > 0:
            continue
        items.append(p)
    return items

@api.get("/products/{product_id}")
async def get_product(product_id: str):
    await release_expired()
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p or p.get("status") == "archived":
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    summary, total = await availability_summary(product_id)
    p["available_by_size"] = summary
    p["available_total"] = total
    return p

@api.get("/public/unit/{unit_code}")
async def public_unit(unit_code: str):
    u = await db.units.find_one({"unit_code": unit_code}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Código no encontrado en el archivo")
    p = await db.products.find_one({"id": u["product_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    return {
        "unit_code": u["unit_code"],
        "edition_number": u.get("edition_number"),
        "size": u.get("size"),
        "color": u.get("color"),
        "status": u.get("status"),
        "piece_name": p["name"],
        "design_code": p["design_code"],
        "edition_name": p.get("edition_name"),
        "edition_total": p.get("edition_total"),
        "concept": p.get("concept"),
        "materials": p.get("materials"),
        "interventions": p.get("interventions"),
        "care": p.get("care"),
        "creator": "Camila Guerra",
        "images": p.get("images", [])[:1],
    }

# ---------------------------------------------------------------------------
# Checkout & orders
# ---------------------------------------------------------------------------
@api.post("/checkout")
async def checkout(body: CheckoutIn, request: Request):
    await release_expired()
    user = await get_optional_user(request)
    if not body.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")
    reserved = []
    line_items = []
    total = 0.0
    try:
        for it in body.items:
            p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
            if not p or p.get("status") != "published":
                raise HTTPException(status_code=400, detail="Pieza no disponible")
            if p.get("price") is None:
                raise HTTPException(status_code=400, detail=f"La pieza '{p['name']}' no tiene precio definido; no se puede comprar todavía")
            unit = await db.units.find_one_and_update(
                {"product_id": it.product_id, "size": it.size, "status": "disponible"},
                {"$set": {"status": "reservada", "order_id": "__pending__",
                          "reserved_until": iso(now_utc() + timedelta(minutes=20))},
                 "$push": {"history": {"at": iso(now_utc()), "action": "reservada"}}})
            if not unit:
                raise HTTPException(status_code=409, detail=f"Sin unidades disponibles de '{p['name']}' en talle {it.size}")
            reserved.append(unit["id"])
            total += float(p["price"])
            line_items.append({"unit_id": unit["id"], "unit_code": unit["unit_code"],
                               "product_id": p["id"], "name": p["name"],
                               "design_code": p["design_code"], "size": it.size,
                               "edition_number": unit.get("edition_number"),
                               "price": float(p["price"]), "image": (p.get("images") or [None])[0]})
    except HTTPException:
        for uid in reserved:
            await db.units.update_one({"id": uid}, {"$set": {"status": "disponible", "order_id": None, "reserved_until": None}})
        raise

    subtotal = total
    ship_cost = 0.0 if body.shipping_method == "retiro" else await compute_shipping(body.shipping_province, subtotal)
    total = subtotal + ship_cost
    order_id = f"order_{uuid.uuid4().hex[:14]}"
    order = {"id": order_id, "status": "created", "kind": "pieces", "items": line_items,
             "subtotal": subtotal, "shipping_cost": ship_cost, "total": total,
             "currency": CURRENCY, "user_id": user["id"] if user else None,
             "guest_email": (body.guest_email.lower() if body.guest_email else (user["email"] if user else None)),
             "guest_name": body.guest_name or (user["name"] if user else None),
             "shipping_method": body.shipping_method, "shipping_address": body.shipping_address,
             "shipping_province": body.shipping_province, "carrier": body.carrier,
             "shipping_status": "pendiente",
             "created_at": iso(now_utc()), "payment": {}}
    await db.orders.insert_one(dict(order))
    for uid in reserved:
        await db.units.update_one({"id": uid}, {"$set": {"order_id": order_id}})

    demo = not bool(MP_ACCESS_TOKEN)
    if demo:
        return {"order_id": order_id, "total": total, "currency": CURRENCY,
                "test_mode": True, "demo": True}
    # Real Mercado Pago preference
    try:
        pref = requests.post("https://api.mercadopago.com/checkout/preferences",
            headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}", "Content-Type": "application/json"},
            json={"items": [{"title": li["name"], "quantity": 1, "unit_price": li["price"], "currency_id": CURRENCY} for li in line_items],
                  "external_reference": order_id,
                  "notification_url": f"{APP_BASE_URL}/api/payments/webhook",
                  "back_urls": {"success": f"{APP_BASE_URL}/payment-result?order_id={order_id}",
                                "pending": f"{APP_BASE_URL}/payment-result?order_id={order_id}",
                                "failure": f"{APP_BASE_URL}/payment-result?order_id={order_id}"},
                  "auto_return": "approved"}, timeout=20).json()
    except Exception:
        raise HTTPException(status_code=502, detail="Error al conectar con Mercado Pago")
    await db.orders.update_one({"id": order_id}, {"$set": {"payment.preference_id": pref.get("id")}})
    return {"order_id": order_id, "total": total, "currency": CURRENCY,
            "test_mode": MP_MODE != "production", "demo": False,
            "checkout_url": pref.get("init_point")}

async def mark_order_paid(order_id: str, payment_info: dict):
    order = await db.orders.find_one({"id": order_id})
    if not order or order.get("status") == "paid":
        return
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "paid", "payment": payment_info, "paid_at": iso(now_utc())}})
    if order.get("kind") == "event":
        await db.event_registrations.update_many({"order_id": order_id}, {"$set": {"status": "pagada"}})
        await send_order_email(order, kind="event")
        return
    for li in order.get("items", []):
        await db.units.update_one({"id": li["unit_id"]}, {"$set": {
            "status": "vendida", "reserved_until": None, "order_id": order_id},
            "$push": {"history": {"at": iso(now_utc()), "action": "vendida", "order_id": order_id}}})
    await send_order_email(order, kind="pieces")


async def send_order_email(order: dict, kind: str):
    to = order.get("guest_email")
    if not to:
        return
    name = order.get("guest_name") or ""
    total = formatARS_py(order.get("total", 0))
    if kind == "event":
        items = "".join(
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#111;font-size:14px">{escape(i.get("name",""))}</td></tr>'
            for i in order.get("items", []))
        html = _email_shell("Tu entrada está confirmada",
            [f"Hola {escape(name)}," if name else "Hola,",
             "Tu pago fue confirmado desde el servidor. Guardá este correo como comprobante.",
             f'<table style="width:100%;border-collapse:collapse">{items}</table>',
             f"Total: {escape(total)}",
             "Podés ver tus inscripciones en Mi Archivo."],
            "Ver Mis Eventos", f"{APP_BASE_URL}/mi-archivo")
        await send_email(to=to, subject="Tu entrada está confirmada · ARCHIVE LAB", html=html)
        return
    rows = ""
    for i in order.get("items", []):
        code = str(i.get("unit_code", ""))
        pdf_url = f"{APP_BASE_URL}/api/certificate/{code}/pdf"
        rows += (f'<tr><td style="padding:10px 0;border-bottom:1px solid #eee">'
                 f'<div style="color:#111;font-size:15px;font-weight:bold">{escape(i.get("name",""))}</div>'
                 f'<div style="color:#666;font-size:12px;margin-top:3px">Talle {escape(str(i.get("size","")))}'
                 f' · ejemplar Nº {escape(str(i.get("edition_number","")))}</div>'
                 f'<div style="color:#111;font-size:13px;font-family:monospace;margin-top:4px;letter-spacing:.05em">'
                 f'Código único: {escape(code)}</div>'
                 f'<a href="{escape(pdf_url)}" style="display:inline-block;margin-top:6px;color:#111;'
                 f'font-size:12px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #111;'
                 f'text-decoration:none">Descargar certificado (PDF)</a></td></tr>')
    html = _email_shell("Tu pieza entró al archivo",
        [f"Hola {escape(name)}," if name else "Hola,",
         "Tu pago fue confirmado. Estas piezas ahora forman parte de tu archivo personal, cada una con su código único permanente:",
         f'<table style="width:100%;border-collapse:collapse">{rows}</table>',
         f"Total: {escape(total)}",
         "En Mi Archivo vas a encontrar la ficha digital y el certificado descargable de cada pieza."],
        "Ver Mi Archivo", f"{APP_BASE_URL}/mi-archivo")
    await send_email(to=to, subject="Tu pieza entró al archivo · ARCHIVE LAB", html=html)


async def send_shipment_email(order: dict):
    to = order.get("guest_email")
    if not to:
        return
    name = order.get("guest_name") or ""
    carrier = order.get("carrier") or ""
    tracking = order.get("tracking_number") or ""
    track_line = f"Transportista: {escape(carrier)} · Seguimiento: {escape(tracking)}" if tracking else ""
    tu = order.get("tracking_url") or ""
    cta_url = tu if tu.startswith("https://") else f"{APP_BASE_URL}/mi-archivo"
    html = _email_shell("Tu pedido está en camino",
        [f"Hola {escape(name)}," if name else "Hola,",
         "Despachamos tu pedido. Ya está viajando hacia vos.",
         track_line,
         "Podés seguir el estado del envío desde el botón de abajo o en Mi Archivo."],
        "Seguir el envío", cta_url)
    await send_email(to=to, subject="Tu pedido está en camino · ARCHIVE LAB", html=html)

@api.post("/demo/approve/{order_id}")
async def demo_approve(order_id: str):
    if MP_ACCESS_TOKEN:
        raise HTTPException(status_code=404, detail="No disponible")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    await mark_order_paid(order_id, {"mode": "demo", "status": "approved"})
    return {"status": "paid", "test_mode": True}

@api.post("/payments/webhook")
async def mp_webhook(request: Request):
    q = request.query_params
    payment_id = q.get("data.id") or q.get("id")
    topic = q.get("type") or q.get("topic")
    if topic not in (None, "payment") or not payment_id or not MP_ACCESS_TOKEN:
        return {"received": True}
    try:
        payment = requests.get(f"https://api.mercadopago.com/v1/payments/{payment_id}",
                               headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}, timeout=20).json()
    except Exception:
        return {"received": True}
    order_id = payment.get("external_reference")
    order = await db.orders.find_one({"id": order_id}) if order_id else None
    if not order:
        return {"received": True}
    if payment.get("status") == "approved" and float(payment.get("transaction_amount", -1)) == float(order["total"]) and payment.get("currency_id") == CURRENCY:
        await mark_order_paid(order_id, {"mode": "mercadopago", "status": "approved", "payment_id": str(payment_id)})
    return {"received": True}

@api.get("/orders/{order_id}")
async def order_status(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return o

@api.get("/my/orders")
async def my_orders(user=Depends(require_user)):
    out = []
    async for o in db.orders.find({"$or": [{"user_id": user["id"]}, {"guest_email": user["email"]}]}, {"_id": 0}).sort("created_at", -1):
        out.append(o)
    return out

@api.post("/orders/{order_id}/claim")
async def claim_order(order_id: str, user=Depends(require_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if o.get("guest_email") and o["guest_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Este pedido pertenece a otro email. Verificá la titularidad.")
    await db.orders.update_one({"id": order_id}, {"$set": {"user_id": user["id"]}})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Events & tickets
# ---------------------------------------------------------------------------
async def event_public(ev):
    cnt = await db.event_registrations.count_documents({"event_id": ev["id"], "status": {"$in": ["anotada", "pagada"]}})
    ev["registered_count"] = cnt
    ev["spots_left"] = (ev["capacity"] - cnt) if ev.get("capacity") else None
    ev["sold_out"] = bool(ev.get("capacity")) and cnt >= ev["capacity"]
    return ev

@api.get("/events")
async def list_events():
    out = []
    async for ev in db.events.find({"status": "published"}, {"_id": 0}).sort("created_at", -1):
        out.append(await event_public(ev))
    return out

@api.get("/events/{event_id}")
async def get_event(event_id: str):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev or ev.get("status") != "published":
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return await event_public(ev)

@api.post("/events/{event_id}/register")
async def register_event(event_id: str, body: EventRegisterIn, request: Request):
    user = await get_optional_user(request)
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev or ev.get("status") != "published":
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    email = body.email.lower()
    if ev.get("capacity"):
        cnt = await db.event_registrations.count_documents({"event_id": event_id, "status": {"$in": ["anotada", "pagada"]}})
        if cnt >= ev["capacity"]:
            raise HTTPException(status_code=409, detail="No quedan cupos para este evento")
    existing = await db.event_registrations.find_one({"event_id": event_id, "email": email, "status": {"$in": ["anotada", "pagada"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás anotada en este evento con ese email")
    reg_id = f"reg_{uuid.uuid4().hex[:12]}"
    reg = {"id": reg_id, "event_id": event_id, "event_title": ev["title"], "event_date": ev.get("date", ""),
           "user_id": user["id"] if user else None, "name": body.name, "email": email,
           "order_id": None, "status": "anotada", "created_at": iso(now_utc())}

    if ev.get("price") is None:
        await db.event_registrations.insert_one(dict(reg))
        return {"registered": True, "paid": False}

    # Paid ticket — same payment mechanism as pieces
    order_id = f"order_{uuid.uuid4().hex[:14]}"
    order = {"id": order_id, "status": "created", "kind": "event", "currency": CURRENCY,
             "items": [{"event_id": event_id, "name": f"Entrada · {ev['title']}", "price": float(ev["price"])}],
             "total": float(ev["price"]), "user_id": user["id"] if user else None,
             "guest_email": email, "guest_name": body.name, "created_at": iso(now_utc()), "payment": {}}
    await db.orders.insert_one(dict(order))
    reg["status"] = "pendiente"
    reg["order_id"] = order_id
    await db.event_registrations.insert_one(dict(reg))

    if not bool(MP_ACCESS_TOKEN):
        return {"registered": True, "paid": True, "demo": True, "order_id": order_id, "total": float(ev["price"])}
    try:
        pref = requests.post("https://api.mercadopago.com/checkout/preferences",
            headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}", "Content-Type": "application/json"},
            json={"items": [{"title": f"Entrada · {ev['title']}", "quantity": 1, "unit_price": float(ev["price"]), "currency_id": CURRENCY}],
                  "external_reference": order_id,
                  "notification_url": f"{APP_BASE_URL}/api/payments/webhook",
                  "back_urls": {"success": f"{APP_BASE_URL}/payment-result?order_id={order_id}",
                                "pending": f"{APP_BASE_URL}/payment-result?order_id={order_id}",
                                "failure": f"{APP_BASE_URL}/payment-result?order_id={order_id}"},
                  "auto_return": "approved"}, timeout=20).json()
    except Exception:
        raise HTTPException(status_code=502, detail="Error al conectar con Mercado Pago")
    await db.orders.update_one({"id": order_id}, {"$set": {"payment.preference_id": pref.get("id")}})
    return {"registered": True, "paid": True, "demo": False, "order_id": order_id,
            "checkout_url": pref.get("init_point"), "total": float(ev["price"])}

@api.get("/my/events")
async def my_events(user=Depends(require_user)):
    out = []
    async for r in db.event_registrations.find({"$or": [{"user_id": user["id"]}, {"email": user["email"]}]}, {"_id": 0}).sort("created_at", -1):
        out.append(r)
    return out

@api.get("/admin/events")
async def admin_list_events(admin=Depends(require_admin)):
    out = []
    async for ev in db.events.find({}, {"_id": 0}).sort("created_at", -1):
        out.append(await event_public(ev))
    return out

@api.post("/admin/events")
async def admin_create_event(body: EventIn, admin=Depends(require_admin)):
    eid = f"event_{uuid.uuid4().hex[:12]}"
    doc = body.model_dump()
    doc["id"] = eid
    doc["created_at"] = iso(now_utc())
    await db.events.insert_one(doc)
    return clean(await db.events.find_one({"id": eid}))

@api.put("/admin/events/{event_id}")
async def admin_update_event(event_id: str, body: EventIn, admin=Depends(require_admin)):
    r = await db.events.update_one({"id": event_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return clean(await db.events.find_one({"id": event_id}))

@api.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, admin=Depends(require_admin)):
    paid = await db.event_registrations.count_documents({"event_id": event_id, "status": "pagada"})
    if paid:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay entradas pagadas. Despublicá el evento en su lugar.")
    await db.event_registrations.delete_many({"event_id": event_id})
    await db.events.delete_one({"id": event_id})
    return {"ok": True}

@api.get("/admin/events/{event_id}/registrations")
async def admin_event_registrations(event_id: str, admin=Depends(require_admin)):
    out = []
    async for r in db.event_registrations.find({"event_id": event_id}, {"_id": 0}).sort("created_at", -1):
        out.append(r)
    return out

# ---------------------------------------------------------------------------
# Releases (próximas liberaciones) & waitlist
# ---------------------------------------------------------------------------
async def _join_waitlist(kind: str, ref_id: str, ref_title: str, body: WaitlistIn, user=None):
    if not body.consent:
        raise HTTPException(status_code=400, detail="Necesitamos tu consentimiento para avisarte")
    email = body.email.lower()
    existing = await db.waitlist.find_one({"kind": kind, "ref_id": ref_id, "email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás en la lista con ese email")
    doc = {"id": f"wl_{uuid.uuid4().hex[:12]}", "kind": kind, "ref_id": ref_id, "ref_title": ref_title,
           "name": body.name, "email": email, "size": body.size, "consent": True,
           "user_id": (user["id"] if user else None), "notified": False, "created_at": iso(now_utc())}
    await db.waitlist.insert_one(dict(doc))
    intro = ("Te sumamos a la lista de espera de esta próxima liberación." if kind == "release"
             else "Te vamos a avisar si esta pieza vuelve al archivo.")
    html = _email_shell(f"Estás en la lista · {ref_title}",
        [f"Hola {escape(body.name)},", intro,
         ("Talle de interés: " + escape(body.size)) if body.size else "",
         "Cuando haya novedades, te escribimos a este correo. Sin spam, sin promesas vacías."],
        "Ver el archivo", f"{APP_BASE_URL}/archivo")
    await send_email(to=email, subject=f"Estás en la lista · {ref_title}", html=html)
    return {"ok": True}

@api.get("/releases")
async def list_releases():
    out = []
    async for r in db.releases.find({"status": "published"}, {"_id": 0}).sort("created_at", -1):
        r["waitlist_count"] = await db.waitlist.count_documents({"kind": "release", "ref_id": r["id"]})
        out.append(r)
    return out

@api.post("/releases/{release_id}/waitlist")
async def release_waitlist(release_id: str, body: WaitlistIn, request: Request):
    r = await db.releases.find_one({"id": release_id}, {"_id": 0})
    if not r or r.get("status") != "published":
        raise HTTPException(status_code=404, detail="Liberación no encontrada")
    user = await get_optional_user(request)
    return await _join_waitlist("release", release_id, r["title"], body, user)

@api.post("/products/{product_id}/waitlist")
async def product_waitlist(product_id: str, body: WaitlistIn, request: Request):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    user = await get_optional_user(request)
    return await _join_waitlist("product", product_id, p["name"], body, user)

@api.get("/admin/releases")
async def admin_list_releases(admin=Depends(require_admin)):
    out = []
    async for r in db.releases.find({}, {"_id": 0}).sort("created_at", -1):
        r["waitlist_count"] = await db.waitlist.count_documents({"kind": "release", "ref_id": r["id"]})
        out.append(r)
    return out

@api.post("/admin/releases")
async def admin_create_release(body: ReleaseIn, admin=Depends(require_admin)):
    rid = f"rel_{uuid.uuid4().hex[:12]}"
    doc = body.model_dump()
    doc["id"] = rid
    doc["created_at"] = iso(now_utc())
    await db.releases.insert_one(doc)
    return clean(await db.releases.find_one({"id": rid}))

@api.put("/admin/releases/{release_id}")
async def admin_update_release(release_id: str, body: ReleaseIn, admin=Depends(require_admin)):
    r = await db.releases.update_one({"id": release_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Liberación no encontrada")
    return clean(await db.releases.find_one({"id": release_id}))

@api.delete("/admin/releases/{release_id}")
async def admin_delete_release(release_id: str, admin=Depends(require_admin)):
    await db.waitlist.delete_many({"kind": "release", "ref_id": release_id})
    await db.releases.delete_one({"id": release_id})
    return {"ok": True}

@api.get("/admin/releases/{release_id}/waitlist")
async def admin_release_waitlist(release_id: str, admin=Depends(require_admin)):
    out = []
    async for w in db.waitlist.find({"kind": "release", "ref_id": release_id}, {"_id": 0}).sort("created_at", -1):
        out.append(w)
    return out

@api.get("/admin/products/{product_id}/waitlist")
async def admin_product_waitlist(product_id: str, admin=Depends(require_admin)):
    out = []
    async for w in db.waitlist.find({"kind": "product", "ref_id": product_id}, {"_id": 0}).sort("created_at", -1):
        out.append(w)
    return out

async def _notify_waitlist(kind: str, ref_id: str, title: str, message: str, cta_url: str):
    sent = 0
    async for w in db.waitlist.find({"kind": kind, "ref_id": ref_id}):
        html = _email_shell(f"Novedades · {title}",
            [f"Hola {escape(w.get('name',''))},", escape(message),
             "Te avisamos porque te anotaste en la lista de espera del archivo."],
            "Ir al archivo", cta_url)
        res = await send_email(to=w["email"], subject=f"Novedades · {title}", html=html)
        if res is not None:
            sent += 1
        await db.waitlist.update_one({"id": w["id"]}, {"$set": {"notified": True}})
    return sent

@api.post("/admin/releases/{release_id}/notify")
async def admin_notify_release(release_id: str, admin=Depends(require_admin)):
    r = await db.releases.find_one({"id": release_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Liberación no encontrada")
    sent = await _notify_waitlist("release", release_id, r["title"],
        f"Ya se liberó: {r['title']}. Entrá al archivo antes de que agote.", f"{APP_BASE_URL}/archivo")
    return {"sent": sent}

@api.post("/admin/products/{product_id}/notify")
async def admin_notify_product(product_id: str, admin=Depends(require_admin)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    sent = await _notify_waitlist("product", product_id, p["name"],
        f"Volvió al archivo: {p['name']}. Hay unidades disponibles de nuevo.",
        f"{APP_BASE_URL}/pieza-expediente/{product_id}")
    return {"sent": sent}

@api.get("/certificate/{unit_code}/pdf")
async def certificate_pdf(unit_code: str):
    u = await db.units.find_one({"unit_code": unit_code}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    p = await db.products.find_one({"id": u["product_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    qbuf = io.BytesIO()
    qrcode.make(f"{APP_BASE_URL}/pieza/{unit_code}").save(qbuf, format="PNG")
    qbuf.seek(0)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColorRGB(0.96, 0.95, 0.94)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(28 * mm, h - 40 * mm, "ARCHIVE")
    c.setFont("Helvetica-Oblique", 20)
    c.drawString(85 * mm, h - 40 * mm, "lab")
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.6, 0.58, 0.54)
    c.drawString(28 * mm, h - 48 * mm, "FICHA DE PIEZA DE ARCHIVO")
    c.setStrokeColorRGB(0.2, 0.2, 0.2)
    c.line(28 * mm, h - 54 * mm, w - 28 * mm, h - 54 * mm)
    c.setFillColorRGB(0.96, 0.95, 0.94)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(28 * mm, h - 70 * mm, p["name"][:34])
    rows = [("Diseño", p["design_code"]), ("Edición", p.get("edition_name", "")),
            ("Código único", u["unit_code"]),
            ("Ejemplar", f"{u['edition_number']} de {p['edition_total']}" if p.get("edition_total") else str(u["edition_number"])),
            ("Talle", u.get("size", "")), ("Color", u.get("color", "")), ("Creadora", "Camila Guerra")]
    y = h - 86 * mm
    for label, val in rows:
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.6, 0.58, 0.54)
        c.drawString(28 * mm, y, label.upper())
        c.setFont("Helvetica-Bold", 12)
        c.setFillColorRGB(0.9, 0.88, 0.86)
        c.drawString(28 * mm, y - 6 * mm, str(val))
        y -= 15 * mm
    c.drawImage(ImageReader(qbuf), w - 70 * mm, 30 * mm, 42 * mm, 42 * mm, mask="auto")
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.6, 0.58, 0.54)
    c.drawString(w - 70 * mm, 26 * mm, f"{APP_BASE_URL}/pieza/{unit_code}")
    c.showPage()
    c.save()
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="archivelab_{unit_code}.pdf"'})

# ---------------------------------------------------------------------------
# Settings & content (public read)
# ---------------------------------------------------------------------------
@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return s or {"id": "main", "currency": CURRENCY, "shipping_zones": [], "pickup_enabled": True,
                 "contact_email": "", "contact_whatsapp": "", "instagram": "archivelab",
                 "pinterest": "", "address": ""}

@api.get("/content/home")
async def get_home():
    c = await db.content.find_one({"id": "home"}, {"_id": 0})
    return c or {"id": "home", "hero_title": "", "hero_subtitle": "", "hero_video": None,
                 "manifesto": "", "creator_bio": ""}

@api.get("/content/legal")
async def get_legal():
    c = await db.content.find_one({"id": "legal"}, {"_id": 0})
    return c or {"id": "legal", "privacy": "", "terms": "", "returns": ""}

# ---------------------------------------------------------------------------
# Admin: products
# ---------------------------------------------------------------------------
@api.get("/admin/products")
async def admin_list_products(admin=Depends(require_admin)):
    out = []
    async for p in db.products.find({}, {"_id": 0}).sort("created_at", -1):
        summary, total = await availability_summary(p["id"])
        units_total = await db.units.count_documents({"product_id": p["id"]})
        p["available_total"] = total
        p["units_total"] = units_total
        out.append(p)
    return out

@api.post("/admin/products")
async def admin_create_product(body: ProductIn, admin=Depends(require_admin)):
    pid = f"prod_{uuid.uuid4().hex[:12]}"
    doc = body.model_dump()
    doc["id"] = pid
    doc["sizes"] = [s if isinstance(s, dict) else s.model_dump() for s in doc.get("sizes", [])]
    doc["created_at"] = iso(now_utc())
    await db.products.insert_one(doc)
    return clean(await db.products.find_one({"id": pid}))

@api.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["sizes"] = [s if isinstance(s, dict) else s.model_dump() for s in doc.get("sizes", [])]
    r = await db.products.update_one({"id": product_id}, {"$set": doc})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    return clean(await db.products.find_one({"id": product_id}))

@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_admin)):
    sold = await db.units.count_documents({"product_id": product_id, "status": {"$in": ["vendida", "reservada"]}})
    if sold:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay unidades vendidas o reservadas. Archivala en su lugar.")
    await db.units.delete_many({"product_id": product_id})
    await db.products.delete_one({"id": product_id})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Admin: units
# ---------------------------------------------------------------------------
@api.get("/admin/products/{product_id}/units")
async def admin_list_units(product_id: str, admin=Depends(require_admin)):
    out = []
    async for u in db.units.find({"product_id": product_id}, {"_id": 0}).sort("edition_number", 1):
        out.append(u)
    return out

@api.post("/admin/products/{product_id}/units")
async def admin_generate_units(product_id: str, body: UnitsGenerateIn, admin=Depends(require_admin)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    existing = await db.units.count_documents({"product_id": product_id})
    created = []
    for i in range(body.quantity):
        edition_number = existing + i + 1
        unit_code = f"AL-{p['design_code']}-{edition_number:03d}-{uuid.uuid4().hex[:4].upper()}"
        while await db.units.find_one({"unit_code": unit_code}):
            unit_code = f"AL-{p['design_code']}-{edition_number:03d}-{uuid.uuid4().hex[:4].upper()}"
        doc = {"id": f"unit_{uuid.uuid4().hex[:12]}", "product_id": product_id,
               "unit_code": unit_code, "edition_number": edition_number,
               "size": body.size, "color": body.color or p.get("color", ""),
               "status": "disponible", "order_id": None, "reserved_until": None,
               "history": [{"at": iso(now_utc()), "action": "creada"}],
               "created_at": iso(now_utc())}
        await db.units.insert_one(dict(doc))
        created.append(clean(doc))
    return created

@api.put("/admin/units/{unit_id}")
async def admin_update_unit(unit_id: str, body: UnitUpdateIn, admin=Depends(require_admin)):
    valid = ["disponible", "reservada", "vendida", "retirada"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail="Estado inválido")
    u = await db.units.find_one({"id": unit_id})
    if not u:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    upd = {"status": body.status}
    if body.status != "reservada":
        upd["reserved_until"] = None
    await db.units.update_one({"id": unit_id}, {"$set": upd,
        "$push": {"history": {"at": iso(now_utc()), "action": f"estado:{body.status}", "note": body.note}}})
    return clean(await db.units.find_one({"id": unit_id}))

@api.get("/admin/units/{unit_id}/qr")
async def admin_unit_qr(unit_id: str, admin=Depends(require_admin)):
    u = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    public_url = f"{APP_BASE_URL}/pieza/{u['unit_code']}"
    img = qrcode.make(public_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = base64.b64encode(buf.getvalue()).decode()
    return {"unit_code": u["unit_code"], "public_url": public_url, "qr": f"data:image/png;base64,{data}"}

@api.get("/admin/products/{product_id}/units/export")
async def admin_export_units(product_id: str, admin=Depends(require_admin)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["unit_code", "pieza", "diseño", "edicion", "n_ejemplar", "talle", "color", "estado", "url_publica"])
    async for u in db.units.find({"product_id": product_id}, {"_id": 0}).sort("edition_number", 1):
        w.writerow([u["unit_code"], p["name"], p["design_code"], p.get("edition_name", ""),
                    u["edition_number"], u["size"], u.get("color", ""), u["status"],
                    f"{APP_BASE_URL}/pieza/{u['unit_code']}"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=unidades_{p['design_code']}.csv"})

# ---------------------------------------------------------------------------
# Admin: orders, settings, content, uploads
# ---------------------------------------------------------------------------
@api.get("/admin/orders")
async def admin_orders(admin=Depends(require_admin)):
    out = []
    async for o in db.orders.find({}, {"_id": 0}).sort("created_at", -1):
        out.append(o)
    return out

@api.put("/admin/orders/{order_id}/shipping")
async def admin_order_shipping(order_id: str, body: ShippingIn, admin=Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    was = o.get("shipping_status")
    upd = {"shipping_status": body.status, "carrier": body.carrier,
           "tracking_number": body.tracking_number, "tracking_url": body.tracking_url}
    if body.status == "enviado" and was != "enviado":
        upd["shipped_at"] = iso(now_utc())
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if body.status == "enviado" and was != "enviado":
        await send_shipment_email(o)
    return o

CARRIER_FIELDS = {
    "andreani": ["usuario", "clave", "cliente", "contrato", "entorno"],
    "oca": ["usuario", "clave", "cuit", "cuenta"],
    "correo": ["usuario", "clave", "cliente"],
}

@api.post("/shipping/quote")
async def shipping_quote(body: QuoteIn):
    s = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
    carriers = await db.settings.find_one({"id": "carriers"}, {"_id": 0}) or {}
    enabled = [k for k in CARRIER_FIELDS if (carriers.get(k) or {}).get("enabled")]
    cost = await compute_shipping(body.province, body.subtotal)
    free = s.get("free_threshold") is not None and body.subtotal >= float(s["free_threshold"])
    label = "Envío a domicilio"
    if enabled:
        label += " (" + ", ".join(c.capitalize() for c in enabled) + ")"
    options = [{"method": "envio", "label": label, "cost": 0 if free else cost, "free": free}]
    if s.get("pickup_enabled", True):
        options.append({"method": "retiro", "label": "Retiro en persona (CABA)", "cost": 0, "free": True})
    return {"options": options}

@api.get("/admin/carriers")
async def admin_get_carriers(admin=Depends(require_admin)):
    doc = await db.settings.find_one({"id": "carriers"}, {"_id": 0}) or {}
    base = {k: (doc.get(k) or {"enabled": False, "credentials": {}}) for k in CARRIER_FIELDS}
    base["fields"] = CARRIER_FIELDS
    return base

@api.put("/admin/carriers")
async def admin_put_carriers(body: CarriersIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = "carriers"
    await db.settings.update_one({"id": "carriers"}, {"$set": doc}, upsert=True)
    return {"ok": True}

async def create_shipment(carrier: str, cfg: dict, order: dict):
    # Integration point per transportista. Se activa al cargar credenciales reales + contrato de API.
    raise HTTPException(status_code=501, detail=(
        f"La generación automática con {carrier.capitalize()} está lista para activarse: cargá las credenciales "
        f"en el panel de Envíos y pedí la activación. Por ahora cargá el seguimiento manualmente en el pedido."))

@api.post("/admin/orders/{order_id}/fulfill")
async def admin_fulfill(order_id: str, carrier: str, admin=Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if carrier not in CARRIER_FIELDS:
        raise HTTPException(status_code=400, detail="Transportista inválido")
    carriers = await db.settings.find_one({"id": "carriers"}, {"_id": 0}) or {}
    cfg = carriers.get(carrier) or {}
    if not cfg.get("enabled") or not (cfg.get("credentials") or {}):
        raise HTTPException(status_code=400, detail=f"Configurá y habilitá {carrier.capitalize()} con sus credenciales en el panel de Envíos.")
    return await create_shipment(carrier, cfg, o)

@api.put("/admin/settings")
async def admin_settings(body: SettingsIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = "main"
    await db.settings.update_one({"id": "main"}, {"$set": doc}, upsert=True)
    return clean(await db.settings.find_one({"id": "main"}))

@api.put("/admin/content/home")
async def admin_home(body: HomeContentIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = "home"
    await db.content.update_one({"id": "home"}, {"$set": doc}, upsert=True)
    return clean(await db.content.find_one({"id": "home"}))

@api.put("/admin/content/legal")
async def admin_legal(body: LegalIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = "legal"
    await db.content.update_one({"id": "legal"}, {"$set": doc}, upsert=True)
    return clean(await db.content.find_one({"id": "legal"}))

@api.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), admin=Depends(require_admin)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"],
                               "original_filename": file.filename, "content_type": file.content_type,
                               "size": result.get("size"), "is_deleted": False,
                               "created_at": iso(now_utc())})
    return {"url": f"{APP_BASE_URL}/api/files/{result['path']}", "path": result["path"]}

@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type") or content_type)

@api.get("/")
async def root():
    return {"name": "ARCHIVE LAB API", "status": "ok"}

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.units.create_index("unit_code", unique=True)
    await db.units.create_index("product_id")
    await db.products.create_index("id")
    await db.orders.create_index("id")
    await db.user_sessions.create_index("session_token")
    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": f"user_{uuid.uuid4().hex[:12]}", "email": admin_email,
                                   "name": "Camila Guerra", "password_hash": hash_password(admin_password),
                                   "role": "admin", "picture": None, "created_at": iso(now_utc())})
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing.get("password_hash") or ""):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
    await seed_demo()
    await seed_events()
    await seed_content()
    await seed_releases()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


async def seed_demo():
    if await db.products.count_documents({}) > 0:
        return
    base = APP_BASE_URL
    img = lambda pid: f"{base}/catalog/{pid}.jpg"
    brand = lambda n: f"{base}/brand/img{n}.jpeg"
    demo = [
        {"design_code": "DNM01", "name": "Campera Intervenida 001", "category": "denim",
         "edition_name": "Liberación I", "edition_total": 8, "price": 89000.0,
         "color": "Índigo profundo", "vip": False,
         "concept": "La campera que no es una más. Base de denim rígido, intervenida a mano pieza por pieza. La elegí porque el peso de la tela sostiene la caída sin romper la silueta.",
         "interventions": "Deshilachado controlado en puños y bajo. Costuras a la vista en hilo contrastante.",
         "materials": "Denim 100% algodón, 14oz. Avíos metálicos envejecidos.",
         "care": "Lavar del revés en agua fría. No usar secadora. Planchar a temperatura media.",
         "shipping_info": "Envío a todo el país. Despacho en 3 a 5 días hábiles.",
         "sizes": [{"label": "1", "measurements": "Hombro 40 · Busto 96 · Largo 58"},
                   {"label": "2", "measurements": "Hombro 42 · Busto 100 · Largo 60"},
                   {"label": "3", "measurements": "Hombro 44 · Busto 104 · Largo 62"}],
         "images": [img("1697924293303-34488b60bf36"), img("1741941171881-40832346c7fe"), img("1572122936109-ce84b9cd5439")],
         "video": f"{base}/brand/hero.mp4", "status": "published"},
        {"design_code": "DNM02", "name": "Jean Expediente Deconstruido", "category": "denim",
         "edition_name": "Liberación I", "edition_total": 10, "price": 76000.0,
         "color": "Azul lavado", "vip": False,
         "concept": "Un jean clásico que se rompe y se vuelve a construir. Formal + rebelde en la misma prenda.",
         "interventions": "Paneles recortados y recosidos. Roturas selladas a mano.",
         "materials": "Denim 100% algodón, 12oz.",
         "care": "Lavar del revés. Evitar secadora.",
         "shipping_info": "Envío a todo el país. Retiro en persona en CABA.",
         "sizes": [{"label": "1", "measurements": "Cintura 66 · Tiro 28"},
                   {"label": "2", "measurements": "Cintura 70 · Tiro 29"},
                   {"label": "3", "measurements": "Cintura 74 · Tiro 30"}],
         "images": [img("1640336437338-5c36f7e1115f"), img("1616411598297-e0053c6ee59d")],
         "video": None, "status": "published"},
        {"design_code": "DNM03", "name": "Campera Doble Liberación", "category": "denim",
         "edition_name": "Liberación I", "edition_total": 6, "price": 98000.0,
         "color": "Negro teñido", "vip": False, "seed_sold_out": True,
         "concept": "Edición agotada. Quedó en el archivo histórico como registro de la primera liberación.",
         "interventions": "Doble capa de denim con intervención total a mano.",
         "materials": "Denim reciclado y nuevo, construcción mixta.",
         "care": "Limpieza en seco recomendada.",
         "shipping_info": "Agotada. Podés anotarte para novedades.",
         "sizes": [{"label": "1", "measurements": "Hombro 41 · Largo 60"},
                   {"label": "2", "measurements": "Hombro 43 · Largo 62"}],
         "images": [img("1699379012687-7da0cd15f3cb"), img("1741941171881-40832346c7fe")],
         "video": None, "status": "published"},
        {"design_code": "INT01", "name": "Corset Expediente", "category": "intima",
         "edition_name": "Liberación I", "edition_total": 5, "price": 72000.0,
         "color": "Negro mate", "vip": False,
         "concept": "Estructura y rebeldía en la misma pieza. Formal y statement al mismo tiempo: la belleza de los opuestos.",
         "interventions": "Ballenas moldeadas. Cierre posterior regulable con cordonería.",
         "materials": "Mezcla de algodón y elastano. Forrería interna de satén.",
         "care": "Limpieza en seco recomendada.",
         "shipping_info": "Envío a todo el país. Retiro en persona disponible en CABA.",
         "sizes": [{"label": "1", "measurements": "Busto 84 · Cintura 64"},
                   {"label": "2", "measurements": "Busto 88 · Cintura 68"}],
         "images": [img("1652397902034-9f9483171e74"), img("1579071072964-395e8239d579")],
         "video": None, "status": "published"},
        {"design_code": "INT02", "name": "Body de Archivo", "category": "intima",
         "edition_name": "Liberación I", "edition_total": 7, "price": 58000.0,
         "color": "Negro", "vip": False,
         "concept": "Minimalista + statement. Una base poderosa para construir el look alrededor.",
         "interventions": "Encaje aplicado a mano en los laterales.",
         "materials": "Microfibra con encaje de algodón.",
         "care": "Lavar a mano en agua fría.",
         "shipping_info": "Envío a todo el país.",
         "sizes": [{"label": "1", "measurements": "Busto 82"},
                   {"label": "2", "measurements": "Busto 86"},
                   {"label": "3", "measurements": "Busto 90"}],
         "images": [img("1618902751861-3de78572c067"), img("1579071072964-395e8239d579")],
         "video": None, "status": "published"},
        {"design_code": "ACC01", "name": "Guantes Intervenidos", "category": "accesorios",
         "edition_name": "Liberación I", "edition_total": 12, "price": 34000.0,
         "color": "Negro", "vip": False,
         "concept": "El detalle que transforma un look entero. Clásico + inesperado.",
         "interventions": "Costura expuesta y largo asimétrico.",
         "materials": "Punto elastizado con terminación mate.",
         "care": "Lavar a mano.",
         "shipping_info": "Envío a todo el país.",
         "sizes": [{"label": "Único", "measurements": "Talle universal"}],
         "images": [img("1617183088274-e1e9e201ebbb")],
         "video": None, "status": "published"},
        {"design_code": "CAR01", "name": "Bolso Archivo", "category": "carteras",
         "edition_name": "Liberación I", "edition_total": 6, "price": 115000.0,
         "color": "Cuero negro", "vip": False,
         "concept": "Un objeto para quedarse. Construido para durar más que cualquier tendencia.",
         "interventions": "Herrajes aplicados a mano. Numeración grabada.",
         "materials": "Cuero vacuno curtido vegetal. Herrajes plateados.",
         "care": "Hidratar el cuero cada tanto. Evitar humedad prolongada.",
         "shipping_info": "Envío asegurado a todo el país.",
         "sizes": [{"label": "Único", "measurements": "28 × 20 × 10 cm"}],
         "images": [img("1614179689702-355944cd0918"), img("1589363358751-ab05797e5629")],
         "video": None, "status": "published"},
        {"design_code": "CAR02", "name": "Cartera Expediente Noche", "category": "carteras",
         "edition_name": "Liberación I", "edition_total": 4, "price": 132000.0,
         "color": "Negro", "vip": False,
         "concept": "Sofisticado + canchero. Para la pieza que cierra el look.",
         "interventions": "Cadena desmontable. Broche escultórico.",
         "materials": "Cuero y metal.",
         "care": "Guardar en su bolsa de tela.",
         "shipping_info": "Envío asegurado a todo el país.",
         "sizes": [{"label": "Único", "measurements": "22 × 14 × 6 cm"}],
         "images": [img("1589363358751-ab05797e5629"), img("1614179689702-355944cd0918")],
         "video": None, "status": "published"},
        {"design_code": "CG01", "name": "Pieza Única — Camila Guerra", "category": "accesorios",
         "edition_name": "Archivo privado", "edition_total": 2, "price": 240000.0,
         "color": "Bone", "vip": True,
         "concept": "Reservada para el archivo de pocas. No todo el mundo puede tenerla.",
         "interventions": "Intervención total a mano por Cami Guerra.",
         "materials": "Materiales de archivo seleccionados pieza por pieza.",
         "care": "Ficha de cuidado incluida con la pieza.",
         "shipping_info": "Entrega coordinada personalmente.",
         "sizes": [{"label": "Único", "measurements": "A medida"}],
         "images": [img("1645951251394-5f841f31e9ee"), img("1635279474047-ab3cda78bbe8")],
         "video": None, "status": "published"},
        {"design_code": "CG02", "name": "Corset Firmado CG", "category": "intima",
         "edition_name": "Archivo privado", "edition_total": 3, "price": 180000.0,
         "color": "Negro", "vip": True,
         "concept": "Femenino + poderoso. Edición firmada, sólo para miembros del archivo.",
         "interventions": "Intervención y firma autorizada de la creadora.",
         "materials": "Satén de seda con estructura interna.",
         "care": "Limpieza en seco exclusivamente.",
         "shipping_info": "Entrega coordinada personalmente.",
         "sizes": [{"label": "1", "measurements": "Busto 84 · Cintura 64"},
                   {"label": "2", "measurements": "Busto 88 · Cintura 68"}],
         "images": [img("1652397902034-9f9483171e74"), brand(1)],
         "video": None, "status": "published"},
        {"design_code": "VST01", "name": "Vestido Avant (consulta)", "category": "intima",
         "edition_name": "Prototipo", "edition_total": None, "price": None,
         "color": "A definir", "vip": False,
         "concept": "Pieza en desarrollo. Todavía no tiene precio ni edición cerrada: podés anotar tu interés.",
         "interventions": "", "materials": "", "care": "", "shipping_info": "",
         "sizes": [{"label": "1", "measurements": ""}],
         "images": [img("1635279474047-ab3cda78bbe8"), img("1717944105945-669b3dd77bfd")],
         "video": None, "status": "published"},
    ]
    created_units = {}
    for d in demo:
        sold_out = d.pop("seed_sold_out", False)
        pid = f"prod_{uuid.uuid4().hex[:12]}"
        d["id"] = pid
        d["created_at"] = iso(now_utc())
        await db.products.insert_one(dict(d))
        total = d.get("edition_total")
        if total:
            per_size = max(1, total // max(1, len(d["sizes"])))
            n = 0
            for sz in d["sizes"]:
                for _ in range(per_size):
                    n += 1
                    code = f"AL-{d['design_code']}-{n:03d}-{uuid.uuid4().hex[:4].upper()}"
                    unit = {"id": f"unit_{uuid.uuid4().hex[:12]}", "product_id": pid,
                        "unit_code": code, "edition_number": n, "size": sz["label"],
                        "color": d.get("color", ""), "status": "vendida" if sold_out else "disponible",
                        "order_id": None, "reserved_until": None,
                        "history": [{"at": iso(now_utc()), "action": "creada"}],
                        "created_at": iso(now_utc())}
                    await db.units.insert_one(dict(unit))
                    created_units.setdefault(d["design_code"], []).append(unit)
    # Ensure a sample customer so Mi Archivo is demoable
    cust = await db.users.find_one({"email": "cliente@test.com"})
    if not cust:
        cust = {"id": f"user_{uuid.uuid4().hex[:12]}", "email": "cliente@test.com",
                "name": "Clienta de prueba", "password_hash": hash_password("Cliente123!"),
                "role": "customer", "picture": None, "created_at": iso(now_utc())}
        await db.users.insert_one(dict(cust))
    # Sample paid order (one Body de Archivo unit) so Mi Archivo shows a piece
    sample_unit = (created_units.get("INT02") or [None])[0]
    if sample_unit:
        prod = next((x for x in demo if x["design_code"] == "INT02"), None)
        oid = f"order_{uuid.uuid4().hex[:14]}"
        item = {"unit_id": sample_unit["id"], "unit_code": sample_unit["unit_code"],
                "product_id": prod["id"], "name": prod["name"], "design_code": "INT02",
                "size": sample_unit["size"], "edition_number": sample_unit["edition_number"],
                "price": prod["price"], "image": prod["images"][0]}
        await db.orders.insert_one({"id": oid, "status": "paid", "kind": "pieces", "items": [item],
            "total": prod["price"], "currency": CURRENCY, "user_id": cust["id"],
            "guest_email": "cliente@test.com", "guest_name": "Clienta de prueba",
            "shipping_method": "envio", "shipping_address": "Buenos Aires",
            "created_at": iso(now_utc()), "paid_at": iso(now_utc()),
            "payment": {"mode": "demo", "status": "approved"}})
        await db.units.update_one({"id": sample_unit["id"]}, {"$set": {"status": "vendida", "order_id": oid},
            "$push": {"history": {"at": iso(now_utc()), "action": "vendida", "order_id": oid}}})
    logger.info("Demo data seeded")


async def seed_events():
    if await db.events.count_documents({}) > 0:
        return
    base = APP_BASE_URL
    img = lambda pid: f"{base}/catalog/{pid}.jpg"
    evs = [
        {"title": "Liberación I — Desfile de apertura", "type": "desfile",
         "description": "Presentación en vivo de la primera liberación del archivo. Cupos limitados, con entrada.",
         "date": "Sábado, hora a confirmar", "location": "Buenos Aires (a confirmar)", "image": img("1635279474047-ab3cda78bbe8"),
         "price": 18000.0, "capacity": 40, "status": "published"},
        {"title": "Visita al laboratorio — Expediente abierto", "type": "presentacion",
         "description": "Recorrido por el proceso detrás de las piezas: intervenciones, materiales y archivo. Entrada libre con inscripción previa.",
         "date": "A confirmar", "location": "Buenos Aires (a confirmar)", "image": f"{base}/brand/img2.jpeg",
         "price": None, "capacity": 25, "status": "published"},
        {"title": "Liberación II — Acceso anticipado para miembros", "type": "lanzamiento",
         "description": "Preview exclusivo de la próxima liberación para miembros del archivo. Entrada libre con inscripción.",
         "date": "A confirmar", "location": "Online + Buenos Aires", "image": img("1717944105945-669b3dd77bfd"),
         "price": None, "capacity": 30, "status": "published"},
        {"title": "Exposición: Archivo Abierto", "type": "exposicion",
         "description": "Muestra de piezas de archivo y su documentación. Entrada general con inscripción.",
         "date": "A confirmar", "location": "Buenos Aires (a confirmar)", "image": img("1645951251394-5f841f31e9ee"),
         "price": 12000.0, "capacity": 50, "status": "published"},
    ]
    created = []
    for e in evs:
        e["id"] = f"event_{uuid.uuid4().hex[:12]}"
        e["created_at"] = iso(now_utc())
        await db.events.insert_one(dict(e))
        created.append(e)
    # Sample registrations for the demo customer
    cust = await db.users.find_one({"email": "cliente@test.com"})
    if cust and created:
        free_ev = next((e for e in created if e["price"] is None), None)
        paid_ev = next((e for e in created if e["price"] is not None), None)
        if free_ev:
            await db.event_registrations.insert_one({"id": f"reg_{uuid.uuid4().hex[:12]}",
                "event_id": free_ev["id"], "event_title": free_ev["title"], "event_date": free_ev.get("date", ""),
                "user_id": cust["id"], "name": "Clienta de prueba", "email": "cliente@test.com",
                "order_id": None, "status": "anotada", "created_at": iso(now_utc())})
        if paid_ev:
            oid = f"order_{uuid.uuid4().hex[:14]}"
            await db.orders.insert_one({"id": oid, "status": "paid", "kind": "event", "currency": CURRENCY,
                "items": [{"event_id": paid_ev["id"], "name": f"Entrada · {paid_ev['title']}", "price": paid_ev["price"]}],
                "total": paid_ev["price"], "user_id": cust["id"], "guest_email": "cliente@test.com",
                "guest_name": "Clienta de prueba", "created_at": iso(now_utc()), "paid_at": iso(now_utc()),
                "payment": {"mode": "demo", "status": "approved"}})
            await db.event_registrations.insert_one({"id": f"reg_{uuid.uuid4().hex[:12]}",
                "event_id": paid_ev["id"], "event_title": paid_ev["title"], "event_date": paid_ev.get("date", ""),
                "user_id": cust["id"], "name": "Clienta de prueba", "email": "cliente@test.com",
                "order_id": oid, "status": "pagada", "created_at": iso(now_utc())})
    logger.info("Demo events seeded")


async def seed_content():
    if not await db.content.find_one({"id": "home"}):
        await db.content.insert_one({"id": "home",
            "hero_title": "Construí tu propio archivo",
            "hero_subtitle": "No necesitás más ropa. Necesitás mejores piezas. Moda de autor en ediciones limitadas, pensada para quedarse.",
            "hero_video": None,
            "manifesto": "Archive Lab funciona como un museo de piezas de archivo. Cada drop es una liberación. Cada prenda tiene su propia identidad. Cada edición es limitada. Cada adquisición pasa a formar parte del archivo personal de quien la compra. No buscamos producir más, sino producir mejor y con intención.",
            "creator_bio": "Camila Guerra — Cami Guerra. Creadora digital, asesora de imagen y modelo, desde Buenos Aires. Diseña cada pieza para que sea reconocible incluso sin logo: la autoría vive en las siluetas, los acabados, las intervenciones y los detalles. La ropa correcta cambia cómo te ven y cómo te sentís. A brillar, amores."})
    if not await db.content.find_one({"id": "legal"}):
        await db.content.insert_one({"id": "legal",
            "privacy": "En Archive Lab cuidamos tus datos. Usamos la información que nos dejás (nombre, email, dirección) únicamente para procesar tus pedidos, inscripciones a eventos y comunicaciones del archivo. No compartimos tus datos con terceros ajenos a la operación. Podés pedir la baja o corrección escribiéndonos. (Texto de ejemplo, ajustable desde el panel.)",
            "terms": "Las piezas de Archive Lab son de autor y de edición limitada. Los precios están expresados en pesos argentinos. El pago se procesa de forma segura a través de Mercado Pago y un pedido se considera confirmado sólo cuando el pago es aprobado. Las reservas de unidades tienen una expiración para evitar la doble venta. (Texto de ejemplo, ajustable desde el panel.)",
            "returns": "Aceptamos cambios dentro de los 10 días de recibida la pieza, conservando su etiqueta y ficha de archivo, siempre que la unidad esté en las mismas condiciones. Por tratarse de piezas de edición limitada e intervenidas a mano, algunas variaciones son parte de su carácter y no se consideran fallas. Escribinos para coordinar. (Texto de ejemplo, ajustable desde el panel.)"})
    if not await db.settings.find_one({"id": "main"}):
        await db.settings.insert_one({"id": "main", "currency": CURRENCY, "shipping_zones": [],
            "pickup_enabled": True, "contact_email": "hola@archivelab.design",
            "contact_whatsapp": "+54 9 11 5555 5555", "instagram": "archivelab",
            "pinterest": "archivelab", "address": "Buenos Aires, Argentina"})
    logger.info("Demo content seeded")


async def seed_releases():
    if await db.releases.count_documents({}) > 0:
        return
    img = lambda pid: f"{APP_BASE_URL}/catalog/{pid}.jpg"
    rels = [
        {"title": "Liberación II — Denim de noche", "description": "La próxima serie de denim intervenido, en tonos profundos. Pocas unidades, sin reposición. Anotate para acceder antes que nadie.",
         "image": img("1699379012687-7da0cd15f3cb"), "teaser_date": "Próximamente", "status": "published"},
        {"title": "Cápsula Corsetería — Archivo privado", "description": "Una cápsula reducida de corsetería de autor. Acceso anticipado para miembros del archivo.",
         "image": img("1652397902034-9f9483171e74"), "teaser_date": "A confirmar", "status": "published"},
    ]
    for r in rels:
        r["id"] = f"rel_{uuid.uuid4().hex[:12]}"
        r["created_at"] = iso(now_utc())
        await db.releases.insert_one(dict(r))
    logger.info("Demo releases seeded")

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=False,
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])
