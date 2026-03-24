import requests
import time

BASE_URL = "http://localhost:8000/api"

def get_token():
    try:
        res = requests.post(f"{BASE_URL}/auth/login", data={"username": "admin@salonpro.com", "password": "admin123"})
        return res.json()["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        return None

def reproduce():
    token = get_token()
    if not token: return
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create a service
    service_id_ts = int(time.time() % 100000)
    service_data = {"name": f"Test Service {service_id_ts}", "category": "Test", "price": 300, "duration": 30}
    service = requests.post(f"{BASE_URL}/services/", json=service_data, headers=headers).json()
    service_id = service["id"]
    print(f"Created service {service_id} with price: {service['price']}")
    
    # 2. Get/Create customer
    customer_id = requests.post(f"{BASE_URL}/customers/", json={"name": "Test Customer", "phone": str(service_id_ts)}, headers=headers).json()["id"]
    
    # 3. Create an appointment
    appt_data = {
        "customer_id": customer_id,
        "date": "2026-05-01",
        "time": "11:00:00",
        "service_ids": [service_id],
        "status": "booked"
    }
    appt = requests.post(f"{BASE_URL}/appointments/", json=appt_data, headers=headers).json()
    appt_id = appt["id"]
    print(f"Created appointment {appt_id} with total: {appt['total_amount']}")
    
    # 4. Update service price
    updated_service_data = {"name": f"Test Service {service_id_ts}", "category": "Test", "price": 350, "duration": 30}
    requests.put(f"{BASE_URL}/services/{service_id}", json=updated_service_data, headers=headers)
    print("Updated service master price to 350")
    
    # 5. Update appointment (status change)
    appt_update = {
        "customer_id": customer_id,
        "date": "2026-05-01",
        "time": "11:00:00",
        "service_ids": [service_id],
        "status": "completed",
        "payment_status": "paid"
    }
    res = requests.put(f"{BASE_URL}/appointments/{appt_id}", json=appt_update, headers=headers)
    updated_appt = res.json()
    
    print(f"Appointment total after update: {updated_appt['total_amount']}")
    print(f"Service price in appointment response: {updated_appt['services'][0]['price']}")
    
    if updated_appt['services'][0]['price'] == 350:
        print("\nISSUE REPRODUCED: The price was updated to 350!")
    else:
        print("\nISSUE FIXED: Price remained 300.")

if __name__ == "__main__":
    reproduce()
