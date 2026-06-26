import { Router, Request, Response } from 'express';
import { daytonaService } from '../services/daytona';

const router = Router();

// ── Health ────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Workspace ─────────────────────────────────────────────────

router.post('/workspace/create', async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    const workspace = await daytonaService.createWorkspace(name);
    res.json({ success: true, data: { id: workspace.id, name: workspace.name, status: workspace.status, createdAt: workspace.createdAt } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/workspace/delete', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const success = await daytonaService.deleteWorkspace(id);
    if (!success) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/workspace/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.query;
    const workspace = await daytonaService.getWorkspaceStatus(id as string);
    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }
    res.json({ success: true, data: { id: workspace.id, name: workspace.name, status: workspace.status, createdAt: workspace.createdAt } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Terminal ──────────────────────────────────────────────────

router.post('/terminal/create', async (_req: Request, res: Response) => {
  try {
    const workspace = await daytonaService.getOrCreateWorkspace();
    const terminal = await daytonaService.createTerminal(workspace.id);
    res.json({ success: true, data: { id: terminal.id, name: terminal.name, workspaceId: terminal.workspaceId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/terminal/list', async (_req: Request, res: Response) => {
  try {
    const terminals = await daytonaService.listTerminals();
    res.json({ success: true, data: terminals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/terminal/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const success = await daytonaService.deleteTerminal(id);
    if (!success) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Files ─────────────────────────────────────────────────────

router.get('/files/tree', async (_req: Request, res: Response) => {
  try {
    const workspace = await daytonaService.getOrCreateWorkspace();
    const files = await daytonaService.listFiles(workspace.id, '.');
    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/files/content', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ success: false, error: 'Path parameter is required' });
      return;
    }
    const content = await daytonaService.readFile(filePath);
    res.json({ success: true, data: content });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Download ──────────────────────────────────────────────────

router.post('/download', async (_req: Request, res: Response) => {
  try {
    const buffer = await daytonaService.downloadWorkspace();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="workspace.zip"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
