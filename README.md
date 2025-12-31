# DeepSeek OCR Demonstrate

A full-stack application demonstrating OCR capabilities using DeepSeek. This project unifies a Python FastAPI backend with a React frontend to provide specific visual feedback on document analysis, including grounding and text-to-bounding-box visualization.

## Project Structure

- **`backend/`**: Python FastAPI application handling OCR processing and image manipulation.
- **`frontend/`**: React application using Vite and Tailwind CSS for the user interface.

## Prerequisites

- Python 3.9+
- Node.js & npm (or bun/yarn)
- `uv` (recommended for Python package management)

## Setup & Running

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   uv sync
   # OR if using standard pip
   pip install -r requirements.txt (if available)
   ```
3. Run the server:
   ```bash
   python main.py
   ```
   The backend API will be available at `http://localhost:8000`.

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## Features

- **Image Upload**: Upload images for OCR processing.
- **DeepSeek Integration**: Utilizes DeepSeek models for text recognition and grounding.
- **Visual Grounding**: Draws bounding boxes around detected text elements on the server side.
- **Interactive Visualization**: Hover over text results to visually connect them to their location on the source image.
- **Bilingual Support**: UI supports multiple languages (English/Traditional Chinese).

## Technologies

- **Backend**: FastAPI, Python, Pillow (PIL), Uvicorn & DeepSeek API
- **Frontend**: React, Vite, Tailwind CSS, Lucide React
