/**
 * Agent Logging Utility
 *
 * Provides consistent logging for all agents for auditing and debugging
 */

import { supabaseAdmin } from './supabase'

export interface AgentActionInput {
  [key: string]: any
}

export interface AgentActionOutput {
  success: boolean
  [key: string]: any
}

/**
 * Log agent action to audit table
 */
export async function logAgentAction(
  userId: string,
  agentName: string,
  input: AgentActionInput,
  output: AgentActionOutput,
  status: 'SUCCESS' | 'ERROR' | 'ESCALATED' = 'SUCCESS'
): Promise<void> {
  try {
    const errorMessage =
      status === 'ERROR' && output.errors
        ? (output.errors as string[]).join('; ')
        : undefined

    const escalationReason =
      status === 'ESCALATED' && output.escalations
        ? `${output.escalations} escalations triggered`
        : undefined

    await supabaseAdmin.from('agent_audit_logs').insert([
      {
        user_id: userId,
        agent_name: agentName,
        action: agentName,
        input_data: input,
        output_data: output,
        status,
        error_message: errorMessage,
        escalation_reason: escalationReason,
        created_at: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error('[agent-logger] Error logging agent action:', error)
  }
}

/**
 * Consistent logging format
 */
export function logAgent(agentName: string, level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${agentName}] [${level}] ${message}`)
}
