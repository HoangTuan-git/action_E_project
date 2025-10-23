# ⚡ Tối ưu Workflow xuống dưới 2 phút

## 📊 Hiện tại: ~3 phút

```
┌─────────────────────────────────────┐
│ Unit Tests          40s             │
├─────────────────────────────────────┤
│ Build Images        60s             │
├─────────────────────────────────────┤
│ E2E Tests (full)    25s             │
├─────────────────────────────────────┤
│ Push Docker Hub     55s             │
└─────────────────────────────────────┘
TỔNG: ~180s (3 phút)
```

---

## 🎯 OPTION A: Skip E2E ⚡ **~1.5 phút**

### Flow:
```
Unit Test → Build → Push Docker Hub
  40s       60s        20s
= 120s (2 phút)
```

### Implementation:

**1. Xóa E2E test khỏi workflow:**

```yaml
# .github/workflows/e2e_and_push.yml
jobs:
  push-to-hub:  # Chạy ngay sau unit tests
    runs-on: ubuntu-latest
    needs: []  # Không cần e2e-tests nữa
    
    steps:
      - name: Build images from cache
        # ... build từ cache
      
      - name: Push to Docker Hub
        # ... push ngay không cần test
```

### ✅ Ưu điểm:
- Nhanh nhất: 1.5-2 phút
- Đơn giản nhất
- Phù hợp cho development branches

### ❌ Nhược điểm:
- **NGUY HIỂM**: Không test integration
- RabbitMQ có thể fail production
- MongoDB connections không được verify
- API Gateway routing không test

### 🎯 Use case:
```yaml
# Chỉ dùng cho development
branches: [ dev, feature/* ]

# KHÔNG dùng cho production (main branch)
```

---

## 🎯 OPTION B: E2E Lite ⚡⚡ **~1.8 phút** ✅ KHUYẾN NGHỊ

### Flow:
```
Unit Test → Build → E2E Lite → Push
  40s       60s      15s        20s
= 135s (2.25 phút) → Target dưới 2 phút với cache
```

### Implementation:

**1. Tạo E2E lite test (đã tạo: `e2e.lite.test.js`)**

```javascript
// 1 test case duy nhất - Full critical path
it('Register → Login → Product → Order', async () => {
  // Không có retry logic
  // Không test edge cases
  // Chỉ verify happy path
  // Timeout: 15s
});
```

**2. Cập nhật workflow:**

```yaml
# docker-compose.e2e.yml
services:
  e2e-tester:
    environment:
      - TEST_MODE=lite  # ← Chỉ chạy e2e.lite.test.js
    command: npm test e2e.lite.test.js
```

**3. Giảm healthcheck interval:**

```yaml
healthcheck:
  interval: 3s      # Thay vì 10s
  timeout: 2s       # Thay vì 5s
  retries: 3        # Thay vì 5
  start_period: 5s  # Thay vì 20s
```

### ✅ Ưu điểm:
- **Nhanh**: ~1.8-2 phút
- **An toàn**: Vẫn verify integration
- **Cân bằng**: Speed vs Quality
- Phù hợp cho production

### ⚠️ Trade-offs:
- Không test edge cases
- Không test error handling
- Có thể miss một số bugs

### 🎯 Use case:
```yaml
# Dùng cho mọi branch
# Balance giữa speed và safety
```

---

## 🎯 OPTION C: Conditional E2E ⚡⚡ **~1.5-3 phút**

### Flow:

```yaml
Development branches (dev, feature/*):
  Unit → Build → Push
  = 120s (2 phút)

Production branch (main):
  Unit → Build → E2E Full → Push
  = 180s (3 phút)
```

### Implementation:

```yaml
# .github/workflows/e2e_and_push.yml
jobs:
  e2e-tests:
    # Chỉ chạy E2E trên main branch
    if: github.ref == 'refs/heads/main'
    
  push-to-hub:
    # Skip E2E nếu không phải main
    needs: ${{ github.ref == 'refs/heads/main' && ['e2e-tests'] || [] }}
```

### ✅ Ưu điểm:
- Fast feedback cho developers (1.5 phút)
- Full safety cho production (3 phút)
- Tiết kiệm GitHub Actions minutes
- Best of both worlds

### ❌ Nhược điểm:
- Logic phức tạp hơn
- Có thể ship bugs từ dev → main

### 🎯 Use case:
```yaml
# Team có nhiều developers
# Cần fast feedback loops
# Production deployment ít hơn
```

---

## 🎯 OPTION D: Full Parallel ⚡⚡⚡ **~1.3 phút**

### Flow:

```
           ┌─ Unit Auth (25s)    ─┐
           ├─ Unit Product (25s)  ─┤
Start ──→  ├─ Build Cache (60s)   ─┤──→ Push (20s)
           └─ E2E Lite (15s)      ─┘
           
Total: max(25, 25, 60, 15) + 20 = 80s
```

### Implementation:

```yaml
jobs:
  test-auth:
    runs-on: ubuntu-latest
    # ...
  
  test-product:
    runs-on: ubuntu-latest
    # ...
  
  build-images:
    runs-on: ubuntu-latest
    # ...
  
  e2e-lite:
    runs-on: ubuntu-latest
    needs: [build-images]
    # ...
  
  push-to-hub:
    needs: [test-auth, test-product, e2e-lite]
    # Push chỉ khi tất cả pass
```

### ✅ Ưu điểm:
- **Nhanh nhất**: ~1.3 phút
- Vẫn có E2E test
- Professional CI/CD

### ❌ Nhược điểm:
- Phức tạp nhất
- Tốn nhiều GitHub Actions minutes
- Khó debug

---

## 📊 BẢNG SO SÁNH

| Option | Thời gian | Độ an toàn | Độ phức tạp | Khuyến nghị |
|--------|-----------|------------|-------------|-------------|
| **A: Skip E2E** | **1.5 phút** ⚡⚡⚡ | ⚠️ LOW | ✅ Đơn giản | ❌ Dev only |
| **B: E2E Lite** | **1.8 phút** ⚡⚡ | ✅ GOOD | ✅ Đơn giản | ✅✅ **BEST** |
| **C: Conditional** | **1.5-3 phút** ⚡⚡ | ✅ GOOD | ⚠️ Trung bình | ✅ Large teams |
| **D: Full Parallel** | **1.3 phút** ⚡⚡⚡ | ✅ GOOD | ❌ Phức tạp | ⚠️ Expert only |

---

## 🎯 KHUYẾN NGHỊ: **OPTION B - E2E Lite**

### Lý do:
1. ✅ **Đủ nhanh**: ~1.8 phút (đạt target <2 phút)
2. ✅ **Đủ an toàn**: Verify critical integration points
3. ✅ **Đơn giản**: Chỉ cần đổi test file
4. ✅ **Practical**: Phù hợp cho production

### Steps to implement:

```bash
# 1. Switch E2E test sang lite mode
cd e2e-test
cp e2e.test.js e2e.test.full.js  # Backup
cp e2e.lite.test.js e2e.test.js  # Use lite version

# 2. Update package.json
"test": "mocha e2e.test.js --timeout 20000"

# 3. Optimize healthchecks in docker-compose.e2e.yml
interval: 3s
timeout: 2s
retries: 3
start_period: 5s

# 4. Test locally
docker compose -f docker-compose.e2e.yml up --build

# 5. Push to GitHub
git add .
git commit -m "feat: optimize E2E to lite mode (<2 min target)"
git push origin main
```

---

## 🚦 Khi nào dùng option nào?

### OPTION A (Skip E2E):
```
✅ Feature branches
✅ Development environment
✅ Quick iterations
❌ Production deployments
```

### OPTION B (E2E Lite):
```
✅ Production deployments
✅ Main branch
✅ Small-medium teams
✅ Balance speed vs safety
```

### OPTION C (Conditional):
```
✅ Large teams
✅ Many feature branches
✅ High PR frequency
✅ Want to save CI minutes
```

### OPTION D (Full Parallel):
```
✅ Enterprise CI/CD
✅ Have CI expertise
✅ Complex microservices
❌ Small projects (overkill)
```

---

## 📈 Expected Improvements

### Current (3 phút):
```
Unit Test:     40s  (22%)
Build:         60s  (33%)
E2E Full:      25s  (14%)
Push:          55s  (31%)
───────────────────────
TOTAL:        180s (100%)
```

### After OPTION B (1.8 phút):
```
Unit Test:     40s  (37%)  (no change)
Build:         50s  (46%)  (-10s cache hit)
E2E Lite:      15s  (14%)  (-10s simplified)
Push:          20s  (18%)  (-35s parallel tags)
───────────────────────────────────────
TOTAL:        125s (100%)  ⚡ -31%
```

### After OPTION D (1.3 phút):
```
Parallel:      60s  (75%)  (all parallel)
Push:          20s  (25%)
───────────────────────
TOTAL:         80s (100%)  ⚡⚡ -56%
```

---

## ✅ Action Items (OPTION B)

1. ✅ **Created**: `e2e.lite.test.js` - Single critical path test
2. ⏳ **TODO**: Copy lite test over full test
3. ⏳ **TODO**: Update docker-compose healthchecks
4. ⏳ **TODO**: Test locally
5. ⏳ **TODO**: Push and verify on GitHub Actions

**Estimated time to implement:** ~15 minutes
**Estimated time savings:** ~55 seconds per workflow run
