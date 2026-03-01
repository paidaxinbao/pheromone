/**
 * Agent Permission System
 * Role-based access control for agents
 */

class PermissionSystem {
  constructor() {
    this.roles = {
      manager: {
        level: 4,
        permissions: [
          'message.send',
          'message.receive',
          'message.broadcast',
          'task.assign',
          'task.update',
          'task.complete',
          'agent.manage',
          'system.config'
        ]
      },
      coordinator: {
        level: 3,
        permissions: [
          'message.send',
          'message.receive',
          'message.broadcast',
          'task.assign',
          'task.update',
          'task.complete'
        ]
      },
      developer: {
        level: 2,
        permissions: [
          'message.send',
          'message.receive',
          'task.update',
          'task.complete'
        ]
      },
      reviewer: {
        level: 2,
        permissions: [
          'message.send',
          'message.receive',
          'task.review',
          'task.update'
        ]
      },
      tester: {
        level: 2,
        permissions: [
          'message.send',
          'message.receive',
          'task.test',
          'task.update'
        ]
      }
    };
    
    this.agentRoles = new Map(); // agentId -> role
  }

  registerAgent(agentId, role = 'developer') {
    if (!this.roles[role]) {
      role = 'developer';
    }
    this.agentRoles.set(agentId, role);
    console.log(`Agent ${agentId} registered with role: ${role}`);
  }

  unregisterAgent(agentId) {
    this.agentRoles.delete(agentId);
  }

  getRole(agentId) {
    return this.agentRoles.get(agentId) || 'developer';
  }

  hasPermission(agentId, permission) {
    const role = this.getRole(agentId);
    const roleConfig = this.roles[role];
    
    if (!roleConfig) {
      return false;
    }
    
    return roleConfig.permissions.includes(permission);
  }

  canSendMessage(fromAgentId, toAgentId) {
    // Managers can send to anyone
    if (this.hasPermission(fromAgentId, 'agent.manage')) {
      return true;
    }
    
    // Same or lower level
    const fromRole = this.getRole(fromAgentId);
    const toRole = this.getRole(toAgentId);
    
    const fromLevel = this.roles[fromRole]?.level || 0;
    const toLevel = this.roles[toRole]?.level || 0;
    
    // Can send to same or lower level
    return fromLevel >= toLevel;
  }

  canAssignTask(agentId) {
    return this.hasPermission(agentId, 'task.assign');
  }

  canBroadcast(agentId) {
    return this.hasPermission(agentId, 'message.broadcast');
  }

  validateMessage(message) {
    const fromAgentId = message.sender?.id;
    const toAgentId = message.recipient?.id;
    const type = message.type;
    
    if (!fromAgentId) {
      return { valid: false, error: 'Missing sender' };
    }
    
    // Check permission for message type
    const permissionMap = {
      'task.assign': 'task.assign',
      'task.update': 'task.update',
      'message.broadcast': 'message.broadcast',
      'message.direct': 'message.send'
    };
    
    const requiredPermission = permissionMap[type] || 'message.send';
    
    if (!this.hasPermission(fromAgentId, requiredPermission)) {
      return { 
        valid: false, 
        error: `Agent ${fromAgentId} lacks permission for ${type}` 
      };
    }
    
    // Check recipient permissions
    if (toAgentId && !this.canSendMessage(fromAgentId, toAgentId)) {
      return { 
        valid: false, 
        error: `Agent ${fromAgentId} cannot send to ${toAgentId}` 
      };
    }
    
    return { valid: true };
  }

  getStats() {
    const stats = {
      totalAgents: this.agentRoles.size,
      byRole: {}
    };
    
    for (const role of Object.keys(this.roles)) {
      stats.byRole[role] = 0;
    }
    
    for (const role of this.agentRoles.values()) {
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    }
    
    return stats;
  }

  getRoleInfo(role) {
    return this.roles[role] || null;
  }

  listRoles() {
    return Object.keys(this.roles).map(role => ({
      name: role,
      level: this.roles[role].level,
      permissions: this.roles[role].permissions.length
    }));
  }
}

module.exports = { PermissionSystem };
