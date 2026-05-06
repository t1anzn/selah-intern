import express from 'express';
import cors from 'cors';
import { router } from './routes';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Selah Intern Sandbox API listening on http://localhost:${PORT}`);
});
