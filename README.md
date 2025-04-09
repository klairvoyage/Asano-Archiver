# Asano Archives 📚🗃️

## Overview

Asano Archives is a web application for downloading PDFs from Kemono.su, specifically designed for content creators' Patreon posts.

![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node.js-v18+-green)
![Express.js](https://img.shields.io/badge/express.js-4.x-orange)

## 🌟 Features

- Browse and select posts from Kemono.su
- Automatically detect PDFs across multiple posts
- Download individual or multiple PDFs simultaneously
- Real-time download progress tracking
- Smart download management with rate limiting

## 🚀 Prerequisites

- Node.js (v18+)
- npm

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/klairvoyage/Asano-Archiver.git
   cd Asano-Archiver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## 💻 Running the Application

### Production Mode
```bash
npm start
```

Access the app at `http://localhost:3000`

### Development Mode
```bash
npm run dev
```

## 🌐 How It Works

1. **Post Discovery**
   - Fetch posts from Kemono.su API
   - Load more posts with pagination
   - Select multiple posts for PDF extraction

2. **PDF Extraction**
   - Scan selected posts for PDF files
   - Use multiple detection methods (API, web scraping)
   - Display PDFs with source post information

3. **Download Process**
   - Download PDFs individually or in bulk
   - Show real-time download progress
   - Save files to a dedicated download folder