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
  gmail: { ...gmailActionConfig, Form: GmailConfigForm },
  gmailTrigger: { ...gmailTriggerConfig, Form: GmailConfigForm },
  githubTrigger: { ...githubTriggerConfig, Form: GitHubTriggerConfigForm },
  aiAgent: { ...aiAgentConfig, Form: AIAgentConfigForm },
  httpRequest: { ...httpRequestConfig, Form: HttpRequestConfigForm },
}

const getNodeConfigSchema = (configType) => nodeConfigRegistry[configType] ?? genericConfig

export { getNodeConfigSchema, nodeConfigRegistry }
