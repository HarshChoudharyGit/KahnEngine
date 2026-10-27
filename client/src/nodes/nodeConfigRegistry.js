import aiAgentConfig from './ai-agent/nodeConfig.js'
import AIAgentConfigForm from './ai-agent/AIAgentConfigForm.jsx'
import { builtInNodeConfigs } from './builtInNodeConfigs.js'
import githubTriggerConfig from './github/nodeConfig.js'
import GitHubTriggerConfigForm from './github/GitHubTriggerConfigForm.jsx'
import gmailActionConfig from './gmail/GmailActionConfig.js'
import gmailTriggerConfig from './gmail/GmailTriggerConfig.js'
import GmailConfigForm from './gmail/GmailConfigForm.jsx'
import httpRequestConfig from './http-request/nodeConfig.js'
import HttpRequestConfigForm from './http-request/HttpRequestConfigForm.jsx'
import scheduleTriggerConfig from './schedule/nodeConfig.js'
import ScheduleConfigForm from './schedule/ScheduleConfigForm.jsx'

const genericConfig = {
  label: 'Node',
  description: 'Configure this workflow node.',
  defaults: {},
  fields: [
    { key: 'title', label: 'Name', type: 'text', required: true },
    { key: 'subtitle', label: 'Description', type: 'text' },
  ],
  validate: (form) => (
    form.title.trim() ? {} : { title: 'Enter a node name.' }
  ),
}

const nodeConfigRegistry = {
  ...builtInNodeConfigs,
  cronTrigger: { ...scheduleTriggerConfig, Form: ScheduleConfigForm },
  scheduleTrigger: { ...scheduleTriggerConfig, Form: ScheduleConfigForm },
  gmail: { ...gmailActionConfig, Form: GmailConfigForm },
  gmailTrigger: { ...gmailTriggerConfig, Form: GmailConfigForm },
  githubTrigger: { ...githubTriggerConfig, Form: GitHubTriggerConfigForm },
  aiAgent: { ...aiAgentConfig, Form: AIAgentConfigForm },
  'ai-agent': { ...aiAgentConfig, Form: AIAgentConfigForm },
  aiagent: { ...aiAgentConfig, Form: AIAgentConfigForm },
  'AI Agent': { ...aiAgentConfig, Form: AIAgentConfigForm },
  httpRequest: { ...httpRequestConfig, Form: HttpRequestConfigForm },
  'http-request': { ...httpRequestConfig, Form: HttpRequestConfigForm },
  httprequest: { ...httpRequestConfig, Form: HttpRequestConfigForm },
  http: { ...httpRequestConfig, Form: HttpRequestConfigForm },
  'http_request': { ...httpRequestConfig, Form: HttpRequestConfigForm },
  'HTTP Request': { ...httpRequestConfig, Form: HttpRequestConfigForm },
}

const normalizeKey = (key) => String(key || '').toLowerCase().replace(/[-_\s]/g, '')

const getNodeConfigSchema = (configType) => {
  if (!configType) return genericConfig
  if (nodeConfigRegistry[configType]) return nodeConfigRegistry[configType]
  const target = normalizeKey(configType)
  const foundKey = Object.keys(nodeConfigRegistry).find(
    (key) => normalizeKey(key) === target,
  )
  return foundKey ? nodeConfigRegistry[foundKey] : genericConfig
}

export { getNodeConfigSchema, nodeConfigRegistry }
