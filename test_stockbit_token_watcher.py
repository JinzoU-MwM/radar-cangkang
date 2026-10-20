# Cek parsing respons /login/refresh: python3 test_stockbit_token_watcher.py
import base64, json, importlib.util

spec = importlib.util.spec_from_file_location("w", "stockbit-token-watcher.py")
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)

def jwt(exp):
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f"{b({'alg': 'HS256'})}.{b({'exp': exp})}.sig"

resp = {"data": {"data": {"access": {"token": jwt(100)}, "refresh": {"token": jwt(900)}}}}
tokens = list(w.find_tokens(resp))
assert w.pick(tokens, False) == jwt(100)
assert w.pick(tokens, True) == jwt(900)
assert w.jwt_exp(jwt(100)) == 100 and w.jwt_exp("bukan-jwt") == 0
assert w.pick(list(w.find_tokens({"msg": "x"})), True) is None
print("ok")
