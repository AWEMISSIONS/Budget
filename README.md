# Family Budget

Reconstruction of the visible Family Budget purpose: plan income, expense categories, recurring bills, savings goals, and transactions by month. Data is encrypted in this browser with AES-GCM using a key derived from the six-digit PIN through PBKDF2. It does not sync or upload data. Users can export an encrypted backup and must retain their PIN to unlock it. If both are lost, the data is unrecoverable.

The live site was PIN-locked and the matching `AWEMISSIONS/Budget` repository had no usable source. This implementation is a new local-first version of the app description, not recovered original code. The PIN is a device privacy feature, not a full account security system or shared household login.
