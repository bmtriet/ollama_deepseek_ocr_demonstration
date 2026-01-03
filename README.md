# DeepSeek OCR Demonstrate

A frontend-driven application demonstrating OCR capabilities using DeepSeek. This project interacts directly with a local Ollama instance to provide visual feedback on document analysis, including grounding and text-to-bounding-box visualization.

## Project Structure

- **`frontend/`**: React application using Vite and Tailwind CSS for the user interface.

## Prerequisites

- Node.js & npm (or bun/yarn)
- [Ollama](https://ollama.com/) running locally
- `deepseek-ocr` model pulled in Ollama: `ollama pull deepseek-ocr`

## Setup & Running

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
- **Ollama Integration**: Interacts directly with local Ollama API.
- **Visual Grounding**: Client-side parsing and rendering of bounding boxes from JSON response.
- **Interactive Visualization**: Hover over text results to visually connect them to their location on the source image.
- **Bilingual Support**: UI supports multiple languages (English/Traditional Chinese).

## Technologies

- **Frontend**: React, Vite, Tailwind CSS, Lucide React, Axios
- **Engine**: Ollama (locally hosted DeepSeek-OCR)
