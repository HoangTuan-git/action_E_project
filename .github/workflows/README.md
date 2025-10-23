# 🔄 CI/CD Workflow Documentation

## 📋 Overview

Repository này sử dụng **2 workflows** để đảm bảo code quality và deployment safety:

### 1. **test.yml** - Continuous Integration
- **Trigger:** Every push/PR
- **Purpose:** Unit tests + Build verification
- **Duration:** ~100s (with cache)

### 2. **e2e_and_push.yml** - Continuous Deployment
- **Trigger:** After test.yml succeeds (workflow_run)
- **Purpose:** E2E tests + Docker Hub deployment
- **Duration:** ~375s (with cache)

---

## 🚀 Workflow Flow

```
┌─────────────────────────────────────────────────────────┐
│                    GIT PUSH TO MAIN                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ WORKFLOW 1: test.yml (CI)                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 1. Checkout Code                                │   │
│ └─────────────────────────────────────────────────┘   │
│                     ↓                                   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 2. Setup Node.js + NPM Cache                    │   │
│ │    cache-key: hash(package-lock.json)           │   │
│ └─────────────────────────────────────────────────┘   │
│                     ↓                                   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 3. Install Dependencies (Parallel)              │   │
│ │    • npm ci --prefix auth &                     │   │
│ │    • npm ci --prefix product &                  │   │
│ └─────────────────────────────────────────────────┘   │
│                     ↓                                   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 4. Run Unit Tests (Parallel)                    │   │
│ │    • auth service tests                         │   │
│ │    • product service tests                      │   │
│ └─────────────────────────────────────────────────┘   │
│                     ↓                                   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 5. Build Docker Images (Cached)                 │   │
│ │    • auth-service                               │   │
│ │    • product-service                            │   │
│ │    • order-service                              │   │
│ │    • api-gateway                                │   │
│ │                                                  │   │
│ │    Cache: type=gha (GitHub Actions)             │   │
│ │    Result: Images built + layers cached         │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ✅ SUCCESS → Trigger workflow 2                        │
│ ❌ FAILURE → Stop (no deployment)                      │
└─────────────────────────────────────────────────────────┘
                          ↓
         (Wait for workflow 1 to complete successfully)
                          ↓
┌─────────────────────────────────────────────────────────┐
│ WORKFLOW 2: e2e_and_push.yml (CD)                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ ┌───────────────────────────────────────────────┐     │
│ │ JOB 1: e2e-tests                              │     │
│ │ ───────────────────────────────────────────── │     │
│ │                                                │     │
│ │ 1. Checkout specific commit (from workflow 1) │     │
│ │    ref: ${{ github.event.workflow_run.head_sha }}  │
│ │                                                │     │
│ │ 2. Build images FROM CACHE                    │     │
│ │    • Load Docker layers from GHA cache        │     │
│ │    • Only rebuild changed layers              │     │
│ │    • 4 images in ~80s (vs 180s without cache) │     │
│ │                                                │     │
│ │ 3. Run E2E Tests                              │     │
│ │    • docker-compose up with test images       │     │
│ │    • 3 critical test cases (~25s)             │     │
│ │                                                │     │
│ │ 4. IF PASS: Save images as artifacts          │     │
│ │    • docker save + gzip                       │     │
│ │    • Upload to GitHub artifacts               │     │
│ │    • retention-days: 1                        │     │
│ │                                                │     │
│ │ 5. IF FAIL: Upload logs                       │     │
│ │    • Capture all service logs                 │     │
│ │    • Upload to artifacts for debugging        │     │
│ │    • STOP workflow (no push)                  │     │
│ └───────────────────────────────────────────────┘     │
│                         ↓                               │
│           ✅ E2E PASSED → Continue                     │
│           ❌ E2E FAILED → STOP                         │
│                         ↓                               │
│ ┌───────────────────────────────────────────────┐     │
│ │ JOB 2: push-to-hub (depends on: e2e-tests)    │     │
│ │ ───────────────────────────────────────────── │     │
│ │                                                │     │
│ │ 1. Download tested image artifacts            │     │
│ │    • auth-service.tar.gz                      │     │
│ │    • product-service.tar.gz                   │     │
│ │    • order-service.tar.gz                     │     │
│ │    • api-gateway.tar.gz                       │     │
│ │                                                │     │
│ │ 2. Load images into Docker                    │     │
│ │    • docker load -i *.tar.gz                  │     │
│ │                                                │     │
│ │ 3. Login to Docker Hub                        │     │
│ │    • username: ${{ secrets.DOCKERHUB_USERNAME }}    │
│ │    • token: ${{ secrets.DOCKERHUB_TOKEN }}    │     │
│ │                                                │     │
│ │ 4. Tag images with multiple versions          │     │
│ │    • :latest                                  │     │
│ │    • :abc1234 (commit SHA)                    │     │
│ │    • :20251023 (date)                         │     │
│ │                                                │     │
│ │ 5. Push all tags to Docker Hub                │     │
│ │    • 4 services × 3 tags = 12 pushes          │     │
│ │                                                │     │
│ │ 6. Create deployment summary                  │     │
│ │    • GitHub Step Summary                      │     │
│ └───────────────────────────────────────────────┘     │
│                                                         │
│ ✅ DEPLOYMENT COMPLETE                                 │
└─────────────────────────────────────────────────────────┘
```

---

## ⏱️ Timing Breakdown

### First Run (Cold Cache)

| Step | Duration | Notes |
|------|----------|-------|
| Workflow 1: Unit Tests + Build | 140s | No cache hits |
| Workflow 2: E2E Tests | 330s | Full image builds |
| Workflow 2: Push to Hub | 210s | Network upload |
| **TOTAL** | **680s (11.3 min)** | Initial deployment |

### Subsequent Runs (Warm Cache)

| Step | Duration | Savings | Notes |
|------|----------|---------|-------|
| Workflow 1: Unit Tests + Build | 100s | **-29%** | NPM + Docker cache |
| Workflow 2: E2E Tests | 195s | **-41%** | Cache hit rate ~90% |
| Workflow 2: Push to Hub | 180s | **-14%** | Smaller diff uploads |
| **TOTAL** | **475s (7.9 min)** | **-30%** | Typical deployment |

### Code Change Only (Best Case)

| Step | Duration | Notes |
|------|----------|-------|
| Workflow 1 | 95s | Only source layers rebuilt |
| Workflow 2 | 180s | Cache hit ~95% |
| **TOTAL** | **~275s (4.6 min)** | 60% faster |

---

## 🔐 Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

```yaml
secrets:
  JWT_SECRET:           # Your JWT secret key (min 32 chars)
  DOCKERHUB_USERNAME:   # Docker Hub username
  DOCKERHUB_TOKEN:      # Docker Hub access token (not password!)
```

### How to create Docker Hub token:

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name: `github-actions-ci`
4. Permissions: Read & Write
5. Copy token to GitHub Secrets

---

## 🎯 Cache Strategy

### NPM Cache

```yaml
cache-key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
```

- **Invalidation:** When package-lock.json changes
- **Size:** ~200 MB
- **Hit rate:** ~95% (only on dependency updates)

### Docker Layer Cache

```yaml
cache-from: type=gha,scope=auth
cache-to: type=gha,mode=max,scope=auth
```

- **Invalidation:** When Dockerfile/code changes
- **Size:** ~2 GB (all services)
- **Hit rate:** ~80-90% (typical development)

### Image Artifacts

```yaml
retention-days: 1
compression-level: 0  # Pre-compressed with gzip
```

- **Purpose:** Share tested images between jobs
- **Size:** ~1.5 GB (compressed)
- **Lifespan:** 1 day (auto-deleted)

---

## 🐛 Debugging Failed Workflows

### Unit Tests Failed (Workflow 1)

```bash
# View logs in GitHub Actions UI
# Or run locally:
cd auth
npm install
npm test

cd ../product
npm install
npm test
```

### E2E Tests Failed (Workflow 2)

1. Download logs artifact: `e2e-failure-logs`
2. View logs for each service
3. Reproduce locally:

```bash
docker compose -f docker-compose.e2e.yml up --build
```

### Push Failed (Workflow 2)

Check:
- ✅ Docker Hub credentials are correct
- ✅ Network issues (retry workflow)
- ✅ Repository exists on Docker Hub

---

## 📊 Monitoring

### GitHub Actions Dashboard

```
Actions tab → Workflows → CI/CD
├─ Success rate
├─ Average duration
├─ Cache hit rate
└─ Failure reasons
```

### Docker Hub

```
https://hub.docker.com/u/<username>
├─ Image sizes
├─ Pull counts
├─ Last updated
└─ Tags list
```

---

## 🔄 Workflow Triggers

### test.yml (CI)

```yaml
on: [push, pull_request]
```

- **Every push** to any branch
- **Every PR** opened/updated

### e2e_and_push.yml (CD)

```yaml
on:
  workflow_run:
    workflows: ["CI - Unit Tests & Build Images (Cached)"]
    types: [completed]
    branches: [main]
```

- **Only on main branch**
- **Only after test.yml succeeds**
- **Automatic trigger** (no manual action needed)

---

## 🚦 Workflow Status Badges

Add to README.md:

```markdown
![CI Tests](https://github.com/<username>/<repo>/actions/workflows/test.yml/badge.svg)
![CD Deploy](https://github.com/<username>/<repo>/actions/workflows/e2e_and_push.yml/badge.svg)
```

---

## 📝 Best Practices

### ✅ DO:
- Keep `package-lock.json` in git
- Use semantic commit messages
- Test locally before pushing
- Monitor cache hit rates
- Clean up old Docker Hub tags periodically

### ❌ DON'T:
- Commit secrets to git
- Skip unit tests
- Push directly to main without PR
- Modify workflow files without understanding impact
- Delete cache without reason

---

## 🆘 Common Issues

### "Workflow run failed to complete"

**Cause:** Workflow 1 failed, so workflow 2 wasn't triggered

**Fix:** Check test.yml logs and fix failing tests

---

### "No space left on device"

**Cause:** Docker cache grew too large

**Fix:** Clear cache in workflow:

```yaml
- name: Prune Docker cache
  run: docker system prune -af --volumes
```

---

### "Rate limit exceeded (Docker Hub)"

**Cause:** Too many pulls from Docker Hub

**Fix:** 
1. Login before pulling: `docker login`
2. Use authenticated pulls (done in workflow)
3. Wait for rate limit reset (6 hours)

---

## 📚 References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Buildx Cache](https://docs.docker.com/build/cache/backends/gha/)
- [Workflow Triggers](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [Cache Optimization Guide](../CACHE_OPTIMIZATION.md)
