// views/clientView.js
function renderClient(client) {
  if (!client) return null;
  return {
    ...client,
    is_casino_player: Boolean(client.is_casino_player),
  };
}

function renderClientWithAccount(client, account) {
  const base = renderClient(client);
  if (!base) return null;
  return { ...base, solde: account ? Number(account.solde) : null };
}

module.exports = { renderClient, renderClientWithAccount };
