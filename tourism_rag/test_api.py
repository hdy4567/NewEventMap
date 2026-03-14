import requests

key = "f3cef6880b1b8a3ea1830dbab6205ebeac41ed6ddb484a897f3c51b6ec0e79fb"
params = {
    "serviceKey": key,
    "numOfRows": 1,
    "pageNo": 1,
    "MobileOS": "WIN",
    "MobileApp": "AppTest",
    "_type": "json"
}

endpoints = [
    "http://apis.data.go.kr/B551011/KorService1/areaBasedList1",
    "http://apis.data.go.kr/B551011/KorService2/areaBasedList2",
    "http://apis.data.go.kr/B551011/KorService4/areaBasedList4",
    "http://apis.data.go.kr/B551011/KorService1/searchKeyword1",
]

for url in endpoints:
    print(f"\nTesting: {url}")
    try:
        # Using requests to handle encoding automatically
        resp = requests.get(url, params=params, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
