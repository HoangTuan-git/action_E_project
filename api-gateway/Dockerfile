# ===============================
# STAGE 1 - DEPENDENCIES
# ===============================
FROM node:18-alpine AS deps

WORKDIR /app

# Chỉ copy package files để đảm bảo cache hợp lệ (nếu code thay đổi, cache vẫn reuse được)
COPY package*.json ./

# Cài dependencies, dùng cache npm nội bộ để tăng tốc độ và tránh tải lại toàn bộ khi rebuild
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# ===============================
# STAGE 2 - RUNTIME
# ===============================
FROM node:18-alpine AS runner

WORKDIR /app

# Copy node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source code vào image
COPY . .

# Thiết lập biến môi trường rõ ràng để dễ debug
ENV NODE_ENV=production \
    PORT=3003

# Expose port
EXPOSE 3003

# Start service
CMD ["npm", "start"]