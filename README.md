# What is Factuality?
Factuality is a mobile app that factchecks live audio using a RAG Pipeline. 
The app transcribes audio, highlights claims, and provides the factuality, confidence, and context for each claim.

## Tech Stack:
The app uses a React Native frontend and Flask backend. It uses a Pinecone vector database, OpenAI GPT-4o-mini LLM, and OpenAI embedding model. Sources are curated on Google's Programmable Search Engine to ensure credbility.

## Demo

https://github.com/user-attachments/assets/76b2f2d9-0a9f-4e24-acc7-f1ee59afd813


## Instructions to run:
- Use python app.py to run backend
  - change the backend URL to the third http address the command above gives you
- npx expo start to run frontend
