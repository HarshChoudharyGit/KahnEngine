import {
  Activity,
  Bot,
  Braces,
  CalendarClock,
  Check,
  GitBranch,
  Globe,
  Layers3,
  Mail,
  MessageCircle,
  Sparkles,
  Timer,
  Webhook,
  Workflow,
} from 'lucide-react'

export const features = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Natural language creation',
    description: 'Describe the outcome you want. Turn a plain-language idea into an editable workflow outline.',
  },
  {
    number: '02',
    icon: Workflow,
    title: 'Visual workflow builder',
    description: 'Shape each step on a flexible canvas. Connect, rearrange, and refine your process as it grows.',
  },
  {
    number: '03',
    icon: GitBranch,
    title: 'AI-powered suggestions',
    description: 'Explore useful next steps, conditions, and improvements while keeping every decision in your hands.',
  },
  {
    number: '04',
    icon: Activity,
    title: 'Execution monitoring',
    description: 'See workflow states at a glance and make it easier to spot the steps that need your attention.',
  },
]

export const disconnectedSteps = [
  { icon: Mail, title: 'Inbox', spot: 'self-start' },
  { icon: Layers3, title: 'Tool A', spot: 'self-end' },
  { icon: Activity, title: 'Manual step', spot: 'self-start' },
  { icon: Check, title: 'Outcome', spot: 'self-end' },
]

export const workflowStages = [
  ['01', 'Describe', 'Start from the task, not a blank canvas.'],
  ['02', 'Arrange', 'Connect steps into a flow you can edit.'],
  ['03', 'Refine', 'Review the logic and make it yours.'],
]

export const workflowPreviewTitle = 'Sort incoming requests'

export const workflowPreviewNodes = [
  { id: 'trigger', icon: Webhook, title: 'Incoming request', detail: 'Webhook Trigger', description: 'An incoming request starts this example flow.', x: 70, y: 150, color: '#d4ad58' },
  { id: 'lookup', icon: Globe, title: 'Fetch request details', detail: 'HTTP Request', description: 'An HTTP request collects details for the workflow.', x: 265, y: 65, color: '#75a98c' },
  { id: 'agent', icon: Bot, title: 'Review the request', detail: 'AI Agent', description: 'An AI step reviews the available context and prepares a response.', x: 480, y: 150, color: '#d68a59', wide: true },
  { id: 'parse', icon: Braces, title: 'Transform the result', detail: 'Transform', description: 'The result is shaped into fields for the next step.', x: 690, y: 150, color: '#c99f62' },
  { id: 'discord', icon: MessageCircle, title: 'Send a notification', detail: 'Discord', description: 'A notification is sent to a Discord channel.', x: 880, y: 150, color: '#75a98c' },
  { id: 'github', icon: GitBranch, title: 'Watch repository activity', detail: 'GitHub Trigger', description: 'Repository activity can start a separate workflow.', x: 250, y: 365, color: '#d68a59', tool: true },
  { id: 'gmail', icon: Mail, title: 'Watch incoming email', detail: 'Gmail', description: 'An incoming email can start a separate workflow.', x: 465, y: 365, color: '#c9b991', tool: true },
  { id: 'delay', icon: Timer, title: 'Pause before continuing', detail: 'Delay', description: 'A delay pauses the workflow before it continues.', x: 680, y: 365, color: '#75a98c', tool: true },
  { id: 'cron', icon: CalendarClock, title: 'Run on a schedule', detail: 'Cron Trigger', description: 'A recurring schedule can start a separate workflow.', x: 875, y: 365, color: '#d4ad58', tool: true },
]

export const workflowPreviewPaths = [
  { from: 'trigger', to: 'lookup', d: 'M70 150 C155 150 175 65 265 65', delay: 0.12 },
  { from: 'lookup', to: 'agent', d: 'M265 65 C360 65 375 150 480 150', delay: 0.42 },
  { from: 'agent', to: 'parse', d: 'M548 150 H622', delay: 0.84 },
  { from: 'parse', to: 'discord', d: 'M758 150 H812', delay: 1.08 },
  { from: 'agent', to: 'github', d: 'M480 195 C450 260 250 270 250 325', delay: 1.4, branch: true },
  { from: 'agent', to: 'gmail', d: 'M480 195 C475 255 465 270 465 325', delay: 1.58, branch: true },
  { from: 'agent', to: 'delay', d: 'M480 195 C510 255 680 270 680 325', delay: 1.76, branch: true },
  { from: 'agent', to: 'cron', d: 'M480 195 C550 260 875 270 875 325', delay: 1.94, branch: true },
]

export const workflowPreviewPoints = [
  [70, 150], [265, 65], [480, 150], [690, 150], [880, 150],
  [250, 325], [465, 325], [680, 325], [875, 325],
]

export const revealProps = (reducedMotion, delay = 0) => ({
  initial: reducedMotion ? false : { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.14 },
  transition: { duration: reducedMotion ? 0 : 0.75, ease: [0.2, 0.7, 0.2, 1], delay },
})
