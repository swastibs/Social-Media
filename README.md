# PostLoop API 🚀

A scalable backend system for a social media–style platform built with **Node.js, Express, Sequelize (MySQL), MongoDB, Redis, JWT authentication, and activity logging**.

It supports:

- Authentication (JWT + Redis token blacklist)
- Users, Posts, Comments system
- Likes system
- Role-based access control (USER / ADMIN)
- Activity logging (MongoDB)
- Redis caching layer
- Request validation (Joi + express-validation)
- File uploads (Multer)
- Swagger API docs

---

## 📦 Tech Stack

- Node.js + Express
- MySQL (Sequelize ORM)
- MongoDB (Activity logs)
- Redis (Caching + Auth token store)
- JWT Authentication
- Passport.js (JWT strategy)
- Joi validation
- Multer (file upload)
- Swagger UI

---

## 🚀 Installation

```bash
git clone <repo-url>
cd postloop
npm install
```

---

## ▶️ Run the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

---

## 🧪 Seed Database

### Create Admin

```bash
node src/seeds/seedAdmin.js
```

### Generate Dummy Data

```bash
node src/seeds/createDummyData.js
```

---

## 📘 API Documentation

Swagger available at:

```
http://localhost:8080/api-docs
```

---

## 🔐 Authentication Flow

- JWT token issued on login
- Token stored in Redis (`auth:token:*`)
- Passport JWT middleware validates token
- Logout removes token from Redis (invalidates session)

---

## 🧠 Core Features

### 👤 Users

- Register / Login / Logout
- Admin can:
  - delete users
  - activate/deactivate users
  - promote users to admin

### 📝 Posts

- Create / update / delete posts
- Upload image (Multer)
- Like / Unlike posts
- View posts with pagination

### 💬 Comments

- Create / update / delete comments
- Nested access via posts/users

### ❤️ Likes

- Toggle like/unlike system
- Optimized with PostLike table

---

## ⚡ Performance Layer

### Redis Caching

- GET requests cached using `cache:` prefix
- TTL: 5 minutes
- Pattern invalidation on mutations

### Cache Invalidation

Triggered automatically on:

- POST / PUT / DELETE routes
- Uses pattern-based deletion (`deleteByPattern`)

---

## 📊 Activity Logging (MongoDB)

Every mutation request logs:

- userId
- route + method
- IP address
- response status
- response time
- entity changes (old/new data)

---

## 🔐 Roles & Permissions

| Role  | Permissions                       |
| ----- | --------------------------------- |
| USER  | Create posts/comments, like, view |
| ADMIN | Full access + user management     |

---

## 📤 File Uploads

- Stored in:

```
src/public/uploads
```

- Access via:

```
/uploads/<filename>
```

---

## 🧾 Validation

All inputs validated using Joi schemas:

- auth.validation.js
- user.validation.js
- post.validation.js
- comment.validation.js

---

## 🧱 Database Models

- User (Sequelize)
- Post (Sequelize)
- Comment (Sequelize)
- PostLike (Sequelize)
- Activity (MongoDB)

---

## 🧠 Key Design Decisions

- Soft delete (`isDeleted`)
- Centralized pagination utility
- DB helper layer for safe entity access
- Activity logging decoupled via middleware
- Redis used for both cache + auth session store
- Role-based middleware enforcement

---

## 🧪 Testing Checklist

Recommended test cases:

- Auth flow (signup/login/logout)
- Token invalidation after logout
- Cache hit vs miss behavior
- Role restrictions (USER vs ADMIN)
- Soft delete propagation (posts/comments/users)
- Activity logs creation
- Like toggle correctness

---

## 📌 Notes

- Ensure Redis + MongoDB + MySQL are running
- Seeder must be run before testing APIs
- JWT_SECRET must be strong in production
- Activity logs auto-expire after 90 days

---