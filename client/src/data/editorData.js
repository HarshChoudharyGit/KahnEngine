import {
  Bot,
  CalendarClock,
  Code2,
  GitBranch,
  Globe,
  Mail,
  MessageCircle,
  Timer,
  Webhook,
} from 'lucide-react'

const edgeStyle = { stroke: '#a68b5a', strokeWidth: 1.8 }
const branchLabelStyle = { fill: '#d7c79f', fontSize: 10, fontWeight: 600 }

const nodeDefinitions = [
  { id: 'githubTrigger', x: 60, y: 70, title: 'GitHub Trigger', subtitle: 'Repository activity', category: 'TRIGGER', icon: GitBranch, accent: '#d67a55', configType: 'githubTrigger' },
  { id: 'gmail', x: 330, y: 70, title: 'Gmail', subtitle: 'Send and manage emails', category: 'ACTION', icon: Mail, accent: '#e87979', configType: 'gmail' },
  { id: 'gmailTrigger', x: 600, y: 70, title: 'Gmail Trigger', subtitle: 'Inbox event start', category: 'TRIGGER', icon: Mail, accent: '#d67a55', configType: 'gmailTrigger' },
]

const initialNodes = nodeDefinitions.map(({ id, x, y, ...data }) => ({
  id,
  type: 'workflow',
  position: { x, y },
  data: { ...data, status: 'idle', configurationStatus: 'unconfigured' },
}))

const edgeDefinitions = [
  { source: 'githubTrigger', target: 'gmail' },
  { source: 'gmail', target: 'gmailTrigger' },
]

const initialEdges = edgeDefinitions.map(({ accent, label, ...connection }) => ({
  ...connection,
  id: `e-${connection.source}-${connection.target}`,
  type: 'smoothstep',
  animated: true,
  style: accent ? { ...edgeStyle, stroke: accent } : edgeStyle,
  ...(label && {
    label,
    labelStyle: branchLabelStyle,
    labelBgStyle: { fill: '#17120e', fillOpacity: 0.95 },
  }),
}))

const nodeOptions = [
  {
    title: 'GitHub Trigger',
    subtitle: 'Start from repository activity',
    category: 'TRIGGER',
    icon: GitBranch,
    accent: '#d67a55',
    configType: 'githubTrigger',
  },
  {
    title: 'Discord',
    subtitle: 'Send messages to a Discord channel',
    category: 'ACTION',
    icon: MessageCircle,
    accent: '#7289da',
    configType: 'discord',
  },
  {
    title: 'Gmail',
    subtitle: 'Send and manage Gmail messages',
    category: 'ACTION',
    icon: Mail,
    accent: '#e87979',
    configType: 'gmail',
  },
  {
    title: 'Gmail Trigger',
    subtitle: 'Start when a matching email arrives',
    category: 'TRIGGER',
    icon: Mail,
    accent: '#d67a55',
    configType: 'gmailTrigger',
  },
  {
    title: 'AI Agent',
    subtitle: 'Process workflow data with an AI model',
    category: 'AI',
    icon: Bot,
    accent: '#71b89d',
    configType: 'aiAgent',
  },
  {
    title: 'HTTP Request',
    subtitle: 'Call an HTTP endpoint',
    category: 'ACTION',
    icon: Globe,
    accent: '#70a8c7',
    configType: 'httpRequest',
  },
  {
    title: 'If / Else',
    subtitle: 'Evaluate a condition and route execution through the matching branch.',
    category: 'LOGIC',
    group: 'Logic / Flow Control',
    icon: GitBranch,
    accent: '#a78bfa',
    configType: 'condition',
    isCondition: true,
  },
  {
    title: 'Webhook Trigger',
    subtitle: 'Start from an incoming HTTP request',
    category: 'TRIGGER',
    icon: Webhook,
    accent: '#d67a55',
    configType: 'webhookTrigger',
  },
  {
    title: 'Transform',
    subtitle: 'Transform workflow data with JavaScript',
    category: 'CORE',
    icon: Code2,
    accent: '#d4ad58',
    configType: 'javascript',
  },
  {
    title: 'Delay',
    subtitle: 'Pause the workflow before continuing',
    category: 'CORE',
    icon: Timer,
    accent: '#d4ad58',
    configType: 'wait',
  },
  {
    title: 'Cron Trigger',
    subtitle: 'Start on a recurring schedule',
    category: 'TRIGGER',
    icon: CalendarClock,
    accent: '#d67a55',
    configType: 'cronTrigger',
  },
]

export { initialNodes, initialEdges, nodeOptions }