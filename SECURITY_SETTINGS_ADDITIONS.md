# JANMITRA — HTTP Security Headers & Credential Scan Audit
**Nagpur Municipal Corporation Civic Grievance Redressal System**

**Audit Date:** 2026-10-20  
**Target Settings Module:** `backend/resolveIT/settings/production.py`  
**Security Standard:** OWASP Top 10, Django Production Deployment Security, NMC Municipal IT Policy

---

## 1. Security Settings Added and Confirmed

The production security configuration in [backend/resolveIT/settings/production.py](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/resolveIT/settings/production.py) has been finalized:

```python
# ==============================================================================
# Production Security Headers & Proxy Configuration
# ==============================================================================
# Render and Cloudflare terminate SSL at their edge reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HTTPS Enforcement & Strict Transport Security (HSTS)
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 31536000))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'True').lower() == 'true'
# HSTS preload is disabled pending a formal domain-readiness review
SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'False').lower() == 'true'
SILENCED_SYSTEM_CHECKS = ['security.W021']  # Preload intentionally deferred pending domain review

# Cookie Security (Transmit only over HTTPS)
SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'True').lower() == 'true'

# HTTP Header Defenses
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_BROWSER_XSS_FILTER = True
```

### Detailed Setting Breakdown

| Setting | Value / Default | Purpose & Protection |
| :--- | :--- | :--- |
| `SECURE_SSL_REDIRECT` | `True` | Forces all non-HTTPS HTTP traffic to redirect with a `301 Moved Permanently` to HTTPS. |
| `SECURE_HSTS_SECONDS` | `31536000` (1 Year) | Injects `Strict-Transport-Security` header telling browsers to communicate strictly over HTTPS for 365 days. |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Extends HSTS policy to all current and future subdomains of the service. |
| `SECURE_HSTS_PRELOAD` | `False` | **Intentionally deferred.** Prevents permanent submission to Chrome/Firefox preload lists until a dedicated domain review is conducted. |
| `SILENCED_SYSTEM_CHECKS` | `['security.W021']` | Formally acknowledges and silences Django's warning regarding `SECURE_HSTS_PRELOAD` being `False`. |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | Injects `X-Content-Type-Options: nosniff` header, preventing browsers from MIME-sniffing away from declared content types. |
| `X_FRAME_OPTIONS` | `"DENY"` | Injects `X-Frame-Options: DENY` via `XFrameOptionsMiddleware` to prevent clickjacking and framing by external sites. |
| `SECURE_BROWSER_XSS_FILTER` | `True` | Injects `X-XSS-Protection: 1; mode=block` for legacy user agents. |
| `SESSION_COOKIE_SECURE` | `True` | Flags Django session cookies as `Secure`, forbidding transmission over unencrypted HTTP. |
| `CSRF_COOKIE_SECURE` | `True` | Flags CSRF verification cookies as `Secure`, protecting against token leakage over plaintext connections. |
| `SECURE_PROXY_SSL_HEADER` | `('HTTP_X_FORWARDED_PROTO', 'https')` | Instructs Django to recognize HTTPS termination by Render's edge load balancer. |

---

## 2. Files Changed

1. **[backend/resolveIT/settings/production.py](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/resolveIT/settings/production.py)**:
   - Configured `SECURE_SSL_REDIRECT = True` by default.
   - Configured `SESSION_COOKIE_SECURE = True` and `CSRF_COOKIE_SECURE = True` by default.
   - Set `SECURE_HSTS_PRELOAD = False` by default and silenced `security.W021`.
   - Confirmed `SECURE_HSTS_SECONDS = 31536000` and `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`.
2. **[backend/accounts/tests/test_production_security_settings.py](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/accounts/tests/test_production_security_settings.py)**:
   - Added focused unit tests:
     - `test_production_security_settings_values`: Tests all 10 security settings values.
     - `test_security_middleware_headers_emitted`: Tests `SecurityMiddleware` and `XFrameOptionsMiddleware` emission of `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
     - `test_secure_ssl_redirect_with_proxy_header`: Tests SSL redirection and proxy header pass-through.
3. **[backend/accounts/tests/__init__.py](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/accounts/tests/__init__.py)**:
   - Exported `ProductionSecuritySettingsTests` for automated discovery.

---

## 3. Credential Scan Scope & Findings

A comprehensive automated regex scan was performed across the entire repository.

### Scope:
- **Scanned Directories:** `backend/`, `frontend/`, root configuration files.
- **Excluded Directories:** `.venv/`, `.venv311/`, `node_modules/`, `staticfiles/`, `__pycache__/`.
- **Target Patterns:** AWS Access Keys, RSA/OpenSSH Private Keys, Generic Secret/Password assignments, Database Connection URLs with embedded credentials, Slack Tokens, Google API Keys.

### Findings & Audit:

| File / Path | Detected Pattern | Status & Detail |
| :--- | :--- | :--- |
| `.gitignore` | Environment & Secret Protection | **CONFIRMED SECURE:** `.env`, `*.log`, `db.sqlite3`, `staticfiles/`, and `media/` are properly ignored. |
| `.env` | File System Check | **CONFIRMED SECURE:** No `.env` file exists or is tracked in Git. Only safe template `.env.example` is present. |
| `RENDER_DEPLOYMENT_GUIDE.md:120` | Database URL with Credentials | **CONFIRMED SAFE:** Documentation example with masked credentials: `postgres://janmitra_user:***@dpg-***-a:5432/janmitra_db`. |
| `backend/resolveIT/settings/production.py:16` | Secret Key Validation | **CONFIRMED SECURE:** Does not provide fallback secrets. Throws `ValueError` if `SECRET_KEY` is not provided in environment. |
| `backend/resolveIT/settings/base.py:40` | Insecure Key Fallback | **CONFIRMED SAFE FOR DEV:** Contains standard Django fallback for local development only (`django-insecure-[REDACTED]`). |
| `backend/resolveIT/settings/local.py:60` | Local Docker Password | **CONFIRMED SAFE FOR DEV:** Contains local development default (`PASSWORD: [REDACTED_DEV_DEFAULT]`), overridden in production. |
| `backend/*/tests/*.py` | Test Passwords | **CONFIRMED SAFE:** Test fixture dummy passwords (`TestPass123!`, `Demo@12345`) used solely in ephemeral test databases. |

> [!NOTE]
> **Zero production credentials, live secrets, private keys, or API tokens were found in the codebase.**

---

## 4. Validation Commands & Actual Results

### A. Django Deployment Security Check (`check --deploy`)
```bash
$env:SECRET_KEY = "dummy-production-secret-key-with-more-than-fifty-characters-for-django-check-1234567890"
$env:DATABASE_URL = "sqlite:///db.sqlite3"
$env:POSTGRES_SSL_REQUIRE = "false"
python backend/manage.py check --deploy --settings=resolveIT.settings.production
```
**Output:**
```
System check identified no issues (1 silenced).
```
*(The 1 silenced issue is `security.W021` for intentionally deferred HSTS preload).*

### B. Standard System Check
```bash
python backend/manage.py check
```
**Output:**
```
System check identified no issues (0 silenced).
```

### C. Security Settings Unit Tests
```bash
python backend/manage.py test accounts.tests.test_production_security_settings --keepdb
```
**Output:**
```
Found 3 test(s).
System check identified no issues (0 silenced).
...
----------------------------------------------------------------------
Ran 3 tests in 0.006s

OK
```

### D. Accounts Module Test Suite
```bash
python backend/manage.py test accounts --keepdb
```
**Output:**
```
Found 82 test(s).
Using existing test database for alias 'default'...
System check identified no issues (0 silenced).
...
----------------------------------------------------------------------
Ran 82 tests in 31.923s

OK
Preserving test database for alias 'default'...
```

---

## 5. Deployment Prerequisites & Remaining Risks

### 1. Reverse Proxy SSL Termination (Render)
- **Requirement:** Render terminates TLS/SSL at its edge router and forwards requests to Gunicorn with the `X-Forwarded-Proto: https` header.
- **Protection:** Configured via `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`. Without this, Django would not recognize the incoming request as HTTPS and would enter an infinite `301` redirect loop.

### 2. Domain Readiness Review for HSTS Preload
- **Current Status:** `SECURE_HSTS_PRELOAD = False`.
- **Preload Risk:** Submitting a domain to the Google Chrome / Mozilla HSTS Preload list (`https://hstspreload.org`) is permanent and hardcodes HTTPS into all major web browsers. If any municipal subdomain (`*.nagpur.gov.in`) or internal portal lacks an active TLS certificate, users will be permanently blocked from accessing it.
- **Prerequisite:** Preload should only be enabled (`SECURE_HSTS_PRELOAD=True`) after all subdomains and municipal DNS zones have been verified for continuous TLS certificate renewal.

### 3. Local Development vs. Production Isolation
- Local development runs using `resolveIT.settings.local`, where `DEBUG = True` and `SECURE_SSL_REDIRECT = False`, allowing developers to test locally over plaintext HTTP without browser certificate warnings.
- Production strictly enforces `resolveIT.settings.production`, where `DEBUG = False` and all HTTP security headers are enforced.
