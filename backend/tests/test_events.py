"""ARCHIVE LAB events & tickets backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')

ADMIN_EMAIL = "camila@archivelab.design"
ADMIN_PASSWORD = "Archive2026!"
CUSTOMER_EMAIL = "cliente@test.com"
CUSTOMER_PASSWORD = "Cliente123!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
    if r.status_code != 200:
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD, "name": "Cliente Test"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---- Public events listing ----
class TestPublicEvents:
    def test_list_events_contains_two_seeded(self, api):
        r = api.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)
        assert len(events) >= 2
        types = [e.get("type") for e in events]
        assert "presentacion" in types
        assert "desfile" in types
        for e in events:
            assert "registered_count" in e
            assert "spots_left" in e
            assert "sold_out" in e
        # Free event: presentacion price None, capacity 25
        free = next(e for e in events if e["type"] == "presentacion")
        assert free["price"] is None
        assert free["capacity"] == 25
        paid = next(e for e in events if e["type"] == "desfile")
        assert float(paid["price"]) == 18000.0
        assert paid["capacity"] == 40


# ---- Register for free event ----
class TestFreeEventRegister:
    def test_register_free_event(self, api):
        events = api.get(f"{BASE_URL}/api/events").json()
        free = next(e for e in events if e["price"] is None)
        email = f"TEST_free_{uuid.uuid4().hex[:8]}@test.com"
        r = api.post(f"{BASE_URL}/api/events/{free['id']}/register",
                     json={"name": "TEST Free User", "email": email})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["registered"] is True
        assert data["paid"] is False

    def test_duplicate_registration_returns_400(self, api):
        events = api.get(f"{BASE_URL}/api/events").json()
        free = next(e for e in events if e["price"] is None)
        email = f"TEST_dup_{uuid.uuid4().hex[:8]}@test.com"
        r1 = api.post(f"{BASE_URL}/api/events/{free['id']}/register",
                      json={"name": "TEST Dup", "email": email})
        assert r1.status_code == 200
        r2 = api.post(f"{BASE_URL}/api/events/{free['id']}/register",
                      json={"name": "TEST Dup", "email": email})
        assert r2.status_code == 400


# ---- Register for paid event (demo flow) ----
class TestPaidEventRegister:
    def test_register_paid_creates_order(self, api):
        events = api.get(f"{BASE_URL}/api/events").json()
        paid = next(e for e in events if e["price"] is not None)
        email = f"TEST_paid_{uuid.uuid4().hex[:8]}@test.com"
        r = api.post(f"{BASE_URL}/api/events/{paid['id']}/register",
                     json={"name": "TEST Paid", "email": email})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["paid"] is True
        assert data["demo"] is True
        assert "order_id" in data
        order_id = data["order_id"]
        # verify order
        o = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        assert o["kind"] == "event"
        assert o["status"] == "created"

        # approve
        ap = api.post(f"{BASE_URL}/api/demo/approve/{order_id}")
        assert ap.status_code == 200
        assert ap.json()["status"] == "paid"
        o2 = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        assert o2["status"] == "paid"


# ---- Capacity enforcement ----
class TestCapacity:
    def test_capacity_enforced(self, api, admin_token):
        hdr = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        payload = {"title": f"TEST_capacity_{uuid.uuid4().hex[:6]}", "type": "presentacion",
                   "description": "test", "date": "soon", "location": "x", "image": None,
                   "price": None, "capacity": 1, "status": "published"}
        r = requests.post(f"{BASE_URL}/api/admin/events", json=payload, headers=hdr)
        assert r.status_code == 200, r.text
        ev = r.json()
        eid = ev["id"]
        try:
            e1 = f"TEST_c1_{uuid.uuid4().hex[:8]}@test.com"
            e2 = f"TEST_c2_{uuid.uuid4().hex[:8]}@test.com"
            r1 = api.post(f"{BASE_URL}/api/events/{eid}/register",
                          json={"name": "u1", "email": e1})
            assert r1.status_code == 200
            r2 = api.post(f"{BASE_URL}/api/events/{eid}/register",
                          json={"name": "u2", "email": e2})
            assert r2.status_code == 409
        finally:
            requests.delete(f"{BASE_URL}/api/admin/events/{eid}", headers=hdr)


# ---- My events ----
class TestMyEvents:
    def test_my_events_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/my/events")
        assert r.status_code == 401

    def test_my_events_authenticated(self, api, customer_token):
        # register customer for free event using their email
        events = api.get(f"{BASE_URL}/api/events").json()
        free = next(e for e in events if e["price"] is None)
        # Use fresh email to avoid dup; add via auth
        hdr = {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}
        # Clean prior registration best-effort by using an email that may already be there
        # Try registering (may 400 if already registered)
        api.post(f"{BASE_URL}/api/events/{free['id']}/register",
                 json={"name": "Cliente Test", "email": CUSTOMER_EMAIL}, headers=hdr)
        r = requests.get(f"{BASE_URL}/api/my/events", headers=hdr)
        assert r.status_code == 200
        regs = r.json()
        assert isinstance(regs, list)
        # should include at least our registration via email match
        assert any(x.get("email") == CUSTOMER_EMAIL for x in regs)


# ---- Admin RBAC ----
class TestAdminRBAC:
    def test_admin_events_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/events")
        assert r.status_code == 401

    def test_admin_events_customer_forbidden(self, customer_token):
        hdr = {"Authorization": f"Bearer {customer_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/events", headers=hdr)
        assert r.status_code == 403

    def test_admin_events_admin_ok(self, admin_token):
        hdr = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/events", headers=hdr)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- Admin CRUD events ----
class TestAdminEventCRUD:
    def test_crud_flow_and_delete_with_paid_blocked(self, api, admin_token):
        hdr = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        # Create
        payload = {"title": f"TEST_crud_{uuid.uuid4().hex[:6]}", "type": "lanzamiento",
                   "description": "d", "date": "soon", "location": "L", "image": None,
                   "price": 5000.0, "capacity": 5, "status": "published"}
        r = requests.post(f"{BASE_URL}/api/admin/events", json=payload, headers=hdr)
        assert r.status_code == 200
        ev = r.json()
        eid = ev["id"]
        assert ev["title"] == payload["title"]
        # Update
        payload["description"] = "updated"
        ru = requests.put(f"{BASE_URL}/api/admin/events/{eid}", json=payload, headers=hdr)
        assert ru.status_code == 200
        assert ru.json()["description"] == "updated"
        # Registrations endpoint empty
        rr = requests.get(f"{BASE_URL}/api/admin/events/{eid}/registrations", headers=hdr)
        assert rr.status_code == 200
        assert rr.json() == []
        # register + pay to make deletion blocked
        email = f"TEST_del_{uuid.uuid4().hex[:8]}@test.com"
        rp = api.post(f"{BASE_URL}/api/events/{eid}/register",
                      json={"name": "x", "email": email})
        assert rp.status_code == 200
        order_id = rp.json()["order_id"]
        api.post(f"{BASE_URL}/api/demo/approve/{order_id}")
        # Delete should 400
        rd = requests.delete(f"{BASE_URL}/api/admin/events/{eid}", headers=hdr)
        assert rd.status_code == 400
        # Mark registration refunded manually? No endpoint; use DB clean approach - leave event (admin UX hint)
        # Clean up: unpublish via update then force delete after resetting status in registrations is not exposed.
        # We'll leave this TEST event in draft to not pollute public list.
        payload["status"] = "draft"
        requests.put(f"{BASE_URL}/api/admin/events/{eid}", json=payload, headers=hdr)


# ---- Pieces checkout regression ----
class TestPiecesRegression:
    def test_pieces_checkout_still_works(self, api):
        products = api.get(f"{BASE_URL}/api/products").json()
        # Find a published product with price & availability
        target = None
        for p in products:
            if p.get("price") and p.get("available_total", 0) > 0:
                target = p
                break
        assert target, "No available paid product for regression test"
        size = next(s for s, c in target["available_by_size"].items() if c > 0)
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@test.com"
        r = api.post(f"{BASE_URL}/api/checkout", json={
            "items": [{"product_id": target["id"], "size": size}],
            "guest_email": email, "guest_name": "TEST",
            "shipping_method": "envio", "shipping_address": "Calle 123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("demo") is True
        oid = data["order_id"]
        ap = api.post(f"{BASE_URL}/api/demo/approve/{oid}")
        assert ap.status_code == 200
        o = api.get(f"{BASE_URL}/api/orders/{oid}").json()
        assert o["status"] == "paid"
        assert o["kind"] == "pieces"
        # verify unit vendida
        unit_code = o["items"][0]["unit_code"]
        pu = api.get(f"{BASE_URL}/api/public/unit/{unit_code}").json()
        assert pu["status"] == "vendida"
