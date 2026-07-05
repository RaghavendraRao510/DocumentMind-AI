# 📄 DocuMind AI

> AI-powered Document Question Answering System built with FastAPI, Next.js, PostgreSQL, ChromaDB, and Google Gemini.

![Python](https://img.shields.io/badge/Python-3.10-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![Next.js](https://img.shields.io/badge/Next.js-Frontend-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Gemini](https://img.shields.io/badge/Google-Gemini-orange)
![License](https://img.shields.io/badge/License-MIT-success)

---

# 🚀 Overview

DocuMind AI allows users to upload PDF documents and ask natural language questions about their contents.

The application uses Retrieval-Augmented Generation (RAG) by combining semantic search with Google Gemini AI to provide accurate answers from uploaded documents.

---

# ✨ Features

- 🔐 User Authentication (JWT)
- 👤 User Registration & Login
- 📄 PDF Upload
- ✂️ Automatic Text Chunking
- 🧠 Sentence Embeddings
- 📚 ChromaDB Vector Database
- 🔍 Semantic Search
- 🤖 Google Gemini AI Integration
- 💬 Document Question Answering
- 📊 Responsive Dashboard
- ⚡ FastAPI REST APIs
- 🎨 Modern Next.js UI

---

# 🏗️ Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Axios
- React Hook Form

## Backend

- FastAPI
- SQLAlchemy
- Alembic
- JWT Authentication
- Passlib (bcrypt)

## Database

- PostgreSQL

## Vector Database

- ChromaDB

## AI & NLP

- Google Gemini API
- Sentence Transformers
- LangChain Text Splitters

---

# 📂 Project Structure

```
DocuMind-AI
│
├── backend
│   ├── app
│   │   ├── api
│   │   ├── auth
│   │   ├── db
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   └── main.py
│   │
│   ├── alembic
│   ├── requirements.txt
│   └── .env
│
├── frontend
│   ├── app
│   ├── components
│   ├── lib
│   ├── package.json
│   └── .env.local
│
└── README.md
```

---

# ⚙️ Installation

## 1. Clone Repository

```bash
git clone https://github.com/yourusername/DocuMind-AI.git

cd DocuMind-AI
```

---

# Backend Setup

## Create Virtual Environment

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configure Environment Variables

Create a `.env` file inside the backend folder.

```env
DATABASE_URL=postgresql://username:password@localhost/documind

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60

GOOGLE_API_KEY=your_google_gemini_api_key
```

---

## Run Database Migration

```bash
alembic upgrade head
```

---

## Start Backend

```bash
uvicorn app.main:app --reload
```

Backend runs at:

```
http://localhost:8000
```

Swagger API Docs:

```
http://localhost:8000/docs
```

---

# Frontend Setup

Go to frontend folder

```bash
cd frontend
```

Install packages

```bash
npm install
```

Create `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run frontend

```bash
npm run dev
```

Application runs at

```
http://localhost:3000
```

---

# 🔄 Application Workflow

```text
User
 │
 ▼
Login/Register
 │
 ▼
Upload PDF
 │
 ▼
Extract Text
 │
 ▼
Split into Chunks
 │
 ▼
Generate Embeddings
 │
 ▼
Store in ChromaDB
 │
 ▼
User asks Question
 │
 ▼
Semantic Search
 │
 ▼
Relevant Chunks
 │
 ▼
Google Gemini
 │
 ▼
AI Answer
```

---

# 📌 API Endpoints

## Authentication

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /auth/register | Register User |
| POST | /auth/login | Login |

---

## Documents

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /documents/upload | Upload PDF |
| GET | /documents | List Documents |
| DELETE | /documents/{id} | Delete Document |

---

## AI

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /chat | Ask Questions |

---

# 📷 Screenshots

Add screenshots here after deployment.

Example:

```
screenshots/

login.png

dashboard.png

upload.png

chat.png
```

---

# 🚀 Deployment

### Frontend

- Vercel

### Backend

- Railway

### Database

- Neon PostgreSQL

### AI

- Google Gemini API

---

# 🔒 Environment Variables

Backend

```env
DATABASE_URL=

SECRET_KEY=

ALGORITHM=

ACCESS_TOKEN_EXPIRE_MINUTES=

GOOGLE_API_KEY=
```

Frontend

```env
NEXT_PUBLIC_API_URL=
```

---

# 📈 Future Improvements

- OCR Support
- Multi-document Chat
- Chat History
- User Profiles
- Admin Dashboard
- Streaming AI Responses
- Docker Support
- Kubernetes Deployment
- Redis Caching
- AWS S3 File Storage

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository

2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Added new feature"
```

4. Push to your branch

```bash
git push origin feature-name
```

5. Open a Pull Request

---

# 📜 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Raghavendra Rao**

GitHub: https://github.com/yourusername

LinkedIn: https://linkedin.com/in/yourprofile

---

⭐ If you found this project helpful, consider giving it a star on GitHub!
