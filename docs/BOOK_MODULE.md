# Student Library Management System - Book Module Documentation

## Overview
The Book Module is a core component of the Student Library Management System, designed to manage book inventory, track borrowing/returns, and maintain library records efficiently.

---

## Module Descriptions

### 1. Authentication Module
- **Purpose:** Handles user registration and login
- **Users:** Students, Librarians
- **Features:**
  - User registration with email validation
  - Secure login/logout
  - Password visibility toggle
  - Session management

### 2. Book Management Module (CRUD)
- **Purpose:** Manages the library's book inventory
- **Features:**
  - Add new books
  - View book details
  - Update book information
  - Delete books from inventory

### 3. Borrowing Module
- **Purpose:** Handles book checkout and return processes
- **Features:**
  - Borrow books
  - Return books
  - Track due dates
  - View borrowing history

---

## Features Per Module

### Book Management (CRUD)

| Operation | Description |
|-----------|-------------|
| **Create** | Add new books with title, author, ISBN, category, and quantity |
| **Read** | View all books, search by title/author/ISBN, view individual book details |
| **Update** | Edit book information (title, author, quantity, category) |
| **Delete** | Remove books from the system (with confirmation) |

### Additional Features
- Search and filter books
- Category-based organization
- Availability status tracking
- Book cover images support

---

## Basic System Flow

```
[USER] → [LOGIN/REGISTER] → [DASHBOARD]
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
       ▼                          ▼                          ▼
[VIEW BOOKS]              [ADD BOOK]                 [BORROW/RETURN]
       │                          │                          │
       ▼                          ▼                          ▼
[SEARCH/FILTER]          [DATABASE]                 [DATABASE]
       │                                                    │
       └────────────────────┬─────────────────────────────┘
                            ▼
                      [CONFIRMATION]
```

### User Flow:
1. User registers or logs in
2. Dashboard displays available books
3. User can search/filter books
4. User borrows a book (if available)
5. System updates availability
6. User returns book on/before due date
7. System updates status and records transaction

---

## Database Tables

### 1. Users Table
```
sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    birthday DATE,
    gender VARCHAR(10),
    role ENUM('student', 'librarian') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Books Table
```
sql
CREATE TABLE books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(100) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    category VARCHAR(50),
    description TEXT,
    quantity INT DEFAULT 1,
    available INT DEFAULT 1,
    cover_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 3. Borrowings Table
```
sql
CREATE TABLE borrowings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE,
    status ENUM('borrowed', 'returned', 'overdue') DEFAULT 'borrowed',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /server/login.php | User login |
| POST | /server/register.php | User registration |

### Books (CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /server/books.php | Get all books |
| GET | /server/books.php?id=1 | Get single book |
| POST | /server/books.php | Add new book |
| PUT | /server/books.php | Update book |
| DELETE | /server/books.php?id=1 | Delete book |

---

## User Roles & Permissions

| Role | Register | View Books | Borrow | Add/Edit/Delete |
|------|----------|------------|--------|-----------------|
| Student | ✓ | ✓ | ✓ | ✗ |
| Librarian | ✓ | ✓ | ✓ | ✓ |

---

## Quick Start

1. **Start XAMPP** - Ensure Apache and MySQL are running
2. **Import Database** - Run schema.sql to create tables
3. **Run Application** - Start React development server
4. **Login/Register** - Create an account
5. **Manage Books** - Use CRUD operations (Librarian)

---

## Technology Stack

- **Frontend:** React.js
- **Backend:** PHP
- **Database:** MySQL (via XAMPP)
- **Styling:** CSS (Glassmorphism UI)

---

## Summary

This Book Module provides a complete solution for managing a student library system with:
- Complete CRUD operations for books
- User authentication system
- Book borrowing and return tracking
- Role-based access control
- Clean, academic-friendly interface

**Version:** 1.0.0  
**Last Updated:** 2024
