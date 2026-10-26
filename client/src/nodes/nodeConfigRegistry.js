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
  // Fallback validator verifying that a node title is provided
  validate: (form) => (
    form.title.trim() ? {} : { title: 'Enter a node name.' }
  ),
}

const nodeConfigRegistry = {
  ...builtInNodeConfigs,
  gmail: { ...gmailActionConfig, Form: GmailConfigForm },
  gmailTrigger: { ...gmailTriggerConfig, Form: GmailConfigForm },
  githubTrigger: { ...githubTriggerConfig, Form: GitHubTriggerConfigForm },
  aiAgent: { ...aiAgentConfig, Form: AIAgentConfigForm },
  httpRequest: { ...httpRequestConfig, Form: HttpRequestConfigForm },
  scheduleTrigger: { ...scheduleTriggerConfig, Form: ScheduleConfigForm },
  cronTrigger: { ...scheduleTriggerConfig, Form: ScheduleConfigForm },
}

// Retrieves the configuration schema and custom form for a given node type
const getNodeConfigSchema = (configType) => nodeConfigRegistry[configType] ?? genericConfig

export { getNodeConfigSchema, nodeConfigRegistry }
