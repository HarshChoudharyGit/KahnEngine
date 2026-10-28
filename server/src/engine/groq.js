import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ChatGroq } from '@langchain/groq';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server root directory regardless of execution CWD
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.GROQ_API_KEY || process.env.CHATGROQ_API_KEY;

if (!apiKey) {
  console.error('Error: GROQ_API_KEY or CHATGROQ_API_KEY not found in server/.env');
  process.exit(1);
}

const llm = new ChatGroq({
  apiKey,
  model: 'openai/gpt-oss-120b',
  temperature: 0,
  maxRetries: 2,
});

console.log('Sending request to Groq...');

const aiMsg = await llm.invoke([
  {
    role: 'system',
    content: 'You are a helpful assistant that translates English to French. Translate the user sentence.',
  },
  {
    role: 'user',
    content: 'I love programming.',
  },
]);

console.log('\n--- Groq Response ---');
console.log(aiMsg.content);