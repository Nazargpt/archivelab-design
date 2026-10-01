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
import requests
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

class SettingsIn(BaseModel):
    currency: str = "ARS"
    shipping_zones: List[dict] = []
    pickup_enabled: bool = True
    contact_email: str = ""
    contact_whatsapp: str = ""
    instagram: str = ""
    pinterest: str = ""
    address: str = ""

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
                        size: Optional[str] = None, availability: Optional[str] = None):
    await release_expired()
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

    order_id = f"order_{uuid.uuid4().hex[:14]}"
    order = {"id": order_id, "status": "created", "kind": "pieces", "items": line_items, "total": total,
             "currency": CURRENCY, "user_id": user["id"] if user else None,
             "guest_email": (body.guest_email.lower() if body.guest_email else (user["email"] if user else None)),
             "guest_name": body.guest_name or (user["name"] if user else None),
             "shipping_method": body.shipping_method, "shipping_address": body.shipping_address,
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
        return
    for li in order.get("items", []):
        await db.units.update_one({"id": li["unit_id"]}, {"$set": {
            "status": "vendida", "reserved_until": None, "order_id": order_id},
            "$push": {"history": {"at": iso(now_utc()), "action": "vendida", "order_id": order_id}}})

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
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


async def seed_demo():
    if await db.products.count_documents({}) > 0:
        return
    base = APP_BASE_URL
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
                   {"label": "2", "measurements": "Hombro 42 · Busto 100 · Largo 60"}],
         "images": [f"{base}/brand/img3.jpeg", f"{base}/brand/img1.jpeg"], "video": None, "status": "published"},
        {"design_code": "INT01", "name": "Corset Expediente", "category": "intima",
         "edition_name": "Liberación I", "edition_total": 5, "price": 72000.0,
         "color": "Negro mate", "vip": False,
         "concept": "Estructura y rebeldía en la misma pieza. Formal y statement al mismo tiempo: la belleza de los opuestos.",
         "interventions": "Ballenas moldeadas. Cierre posterior regulable.",
         "materials": "Mezcla de algodón y elastano. Forrería interna de satén.",
         "care": "Limpieza en seco recomendada.",
         "shipping_info": "Envío a todo el país. Retiro en persona disponible en CABA.",
         "sizes": [{"label": "1", "measurements": "Busto 84 · Cintura 64"},
                   {"label": "2", "measurements": "Busto 88 · Cintura 68"}],
         "images": [f"{base}/brand/img1.jpeg", f"{base}/brand/img2.jpeg"], "video": None, "status": "published"},
        {"design_code": "CAR01", "name": "Bolso Archivo", "category": "carteras",
         "edition_name": "Liberación I", "edition_total": 6, "price": 115000.0,
         "color": "Cuero natural", "vip": False,
         "concept": "Un objeto para quedarse. Construido para durar más que cualquier tendencia.",
         "interventions": "Herrajes aplicados a mano. Numeración grabada.",
         "materials": "Cuero vacuno curtido vegetal.",
         "care": "Hidratar el cuero cada tanto. Evitar humedad prolongada.",
         "shipping_info": "Envío asegurado a todo el país.",
         "sizes": [{"label": "Único", "measurements": "28 × 20 × 10 cm"}],
         "images": [f"{base}/brand/img2.jpeg", f"{base}/brand/img3.jpeg"], "video": None, "status": "published"},
        {"design_code": "CG01", "name": "Pieza Única — Camila Guerra", "category": "accesorios",
         "edition_name": "Archivo privado", "edition_total": 2, "price": 240000.0,
         "color": "Bone", "vip": True,
         "concept": "Reservada para el archivo de pocas. No todo el mundo puede tenerla.",
         "interventions": "Intervención total a mano por Cami Guerra.",
         "materials": "Materiales de archivo seleccionados pieza por pieza.",
         "care": "Ficha de cuidado incluida con la pieza.",
         "shipping_info": "Entrega coordinada personalmente.",
         "sizes": [{"label": "Único", "measurements": "A medida"}],
         "images": [f"{base}/brand/img1.jpeg", f"{base}/brand/img2.jpeg"], "video": None, "status": "published"},
        {"design_code": "VST01", "name": "Vestido Avant (consulta)", "category": "intima",
         "edition_name": "Prototipo", "edition_total": None, "price": None,
         "color": "A definir", "vip": False,
         "concept": "Pieza en desarrollo. Todavía no tiene precio ni edición cerrada: podés anotar tu interés.",
         "interventions": "", "materials": "", "care": "", "shipping_info": "",
         "sizes": [{"label": "1", "measurements": ""}],
         "images": [f"{base}/brand/img2.jpeg"], "video": None, "status": "published"},
    ]
    for d in demo:
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
                    await db.units.insert_one({"id": f"unit_{uuid.uuid4().hex[:12]}", "product_id": pid,
                        "unit_code": code, "edition_number": n, "size": sz["label"],
                        "color": d.get("color", ""), "status": "disponible", "order_id": None,
                        "reserved_until": None, "history": [{"at": iso(now_utc()), "action": "creada"}],
                        "created_at": iso(now_utc())})
    logger.info("Demo data seeded")


async def seed_events():
    if await db.events.count_documents({}) > 0:
        return
    base = APP_BASE_URL
    evs = [
        {"title": "Liberación I — Desfile de apertura", "type": "desfile",
         "description": "Presentación en vivo de la primera liberación del archivo. Cupos limitados, con entrada.",
         "date": "A confirmar", "location": "Buenos Aires (a confirmar)", "image": f"{base}/brand/img3.jpeg",
         "price": 18000.0, "capacity": 40, "status": "published"},
        {"title": "Visita al laboratorio — Expediente abierto", "type": "presentacion",
         "description": "Recorrido por el proceso detrás de las piezas: intervenciones, materiales y archivo. Entrada libre con inscripción previa.",
         "date": "A confirmar", "location": "Buenos Aires (a confirmar)", "image": f"{base}/brand/img2.jpeg",
         "price": None, "capacity": 25, "status": "published"},
    ]
    for e in evs:
        e["id"] = f"event_{uuid.uuid4().hex[:12]}"
        e["created_at"] = iso(now_utc())
        await db.events.insert_one(dict(e))
    logger.info("Demo events seeded")

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=False,
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])
