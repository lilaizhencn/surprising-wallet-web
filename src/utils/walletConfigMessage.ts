type Translate = (message: string, values?: Record<string, string | number>) => string;

const dynamicMessages: Array<{
  pattern: RegExp;
  template: string;
  valueKey: string;
}> = [
  {
    pattern: /^No enabled RPC node for environment (.+)\.$/,
    template: 'No enabled RPC node for environment {environment}.',
    valueKey: 'environment',
  },
  {
    pattern: /^No enabled RPC node is configured for environment (.+)\.$/,
    template: 'No enabled RPC node is configured for environment {environment}.',
    valueKey: 'environment',
  },
  {
    pattern: /^Only one network can be enabled per chain at a time: (.+)$/,
    template: 'Only one network can be enabled per chain at a time: {networks}',
    valueKey: 'networks',
  },
  {
    pattern: /^an enabled chain must retain an enabled RPC node for required purpose (.+)$/,
    template: 'An enabled chain must retain an enabled RPC node for required purpose {purpose}.',
    valueKey: 'purpose',
  },
  {
    pattern: /^(.+) does not declare its network\.$/,
    template: '{symbol} does not declare its network.',
    valueKey: 'symbol',
  },
  {
    pattern: /^(.+) has no matching enabled chain profile\.$/,
    template: '{symbol} has no matching enabled chain profile.',
    valueKey: 'symbol',
  },
  {
    pattern: /^(.+) has no matching active chain asset\.$/,
    template: '{symbol} has no matching active chain asset.',
    valueKey: 'symbol',
  },
  {
    pattern: /^(.+) contract differs from chain_asset\.$/,
    template: '{symbol} contract differs from chain_asset.',
    valueKey: 'symbol',
  },
  {
    pattern: /^(.+) has no matching enabled token configuration\.$/,
    template: '{symbol} has no matching enabled token configuration.',
    valueKey: 'symbol',
  },
];

export function translateWalletConfigMessage(message: string, t: Translate) {
  for (const definition of dynamicMessages) {
    const match = message.match(definition.pattern);
    if (match) {
      return t(definition.template, { [definition.valueKey]: match[1] });
    }
  }
  return t(message);
}
