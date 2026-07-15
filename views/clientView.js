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

function renderKyc(kyc) {
  if (!kyc) return null;
  return {
    ...kyc,
    doc_piece_identite: Boolean(kyc.doc_piece_identite),
    doc_justificatif_domicile: Boolean(kyc.doc_justificatif_domicile),
    doc_photo_client: Boolean(kyc.doc_photo_client),
    declaration_client: Boolean(kyc.declaration_client),
  };
}

function renderClientWithKyc(client, account, kyc) {
  const base = renderClientWithAccount(client, account);
  if (!base) return null;
  return { ...base, kyc: renderKyc(kyc) };
}

module.exports = { renderClient, renderClientWithAccount, renderKyc, renderClientWithKyc };