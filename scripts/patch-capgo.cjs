const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..', 'node_modules', '@capgo', 'capacitor-updater', 'android', 'src', 'main', 'java', 'ee', 'forgr', 'capacitor_updater');

function patchFile(fileName, transforms) {
  const filePath = path.join(baseDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-capgo] Arquivo não encontrado: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  for (const [target, replacement] of transforms) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      count++;
    } else {
      console.warn(`[patch-capgo] Target não encontrado em ${fileName}: ${target.slice(0, 40)}...`);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-capgo] ${fileName}: ${count} patch(es) aplicado(s)`);
}

// 1. DownloadService.java: Não falhar se checksum for vazio
patchFile('DownloadService.java', [
  [
`        if (checksum == null || checksum.isEmpty()) {
            logger.error("No checksum provided");
            sendStatsAsync("checksum_required", version);
            throw new RuntimeException("Checksum required");
        }`,
`        if (checksum == null || checksum.isEmpty()) {
            logger.info("No checksum provided, proceeding without verification");
        }`
  ]
]);

// 2. CapacitorUpdaterPlugin.java: Não rejeitar download se checksum for vazio
patchFile('CapacitorUpdaterPlugin.java', [
  [
`        if (manifest == null && (checksum == null || checksum.isEmpty())) {
            logger.error("No checksum provided");
            this.implementation.sendStats("checksum_required");
            throw new IOException("Checksum required");
        }`,
`        if (manifest == null && (checksum == null || checksum.isEmpty())) {
            logger.info("No checksum provided, proceeding without verification");
        }`
  ],
  [
`        if (!latest.has("manifest") && (checksum == null || checksum.isEmpty())) {
            logger.error("No checksum provided");
            this.implementation.sendStats("checksum_required", latestVersionName);
            return "Checksum required";
        }`,
`        if (!latest.has("manifest") && (checksum == null || checksum.isEmpty())) {
            logger.info("No checksum provided in latest, proceeding");
        }`
  ]
]);

// 3. CapgoUpdater.java: Tornar verificação de checksum opcional
patchFile('CapgoUpdater.java', [
  [
`    private void requireBundleChecksum(final String checksum) throws IOException {
        if (checksum == null || checksum.isEmpty()) {
            logger.error("No checksum provided");
            this.sendStats("checksum_required");
            throw new IOException("Checksum required");
        }
    }`,
`    private void requireBundleChecksum(final String checksum) throws IOException {
        if (checksum == null || checksum.isEmpty()) {
            logger.info("No checksum provided, skipping requirement");
            return;
        }
    }`
  ],
  [
`            if (!isManifest) {
                String expectedChecksum = Objects.requireNonNullElse(checksumRes, "");
                this.requireBundleChecksum(expectedChecksum);

                if (CryptoCipher.isValidSessionKey(sessionKey)) {
                    CryptoCipher.decryptFile(downloaded, publicKey, sessionKey);
                    expectedChecksum = CryptoCipher.decryptChecksum(checksumRes, publicKey);
                }
                checksum = CryptoCipher.calcChecksum(downloaded);
                CryptoCipher.logChecksumInfo("Calculated checksum", checksum);
                CryptoCipher.logChecksumInfo("Expected checksum", expectedChecksum);
                if (!expectedChecksum.equals(checksum)) {
                    logger.error("Checksum mismatch");
                    logger.debug("Expected: " + expectedChecksum + ", Got: " + checksum);
                    this.sendStats("checksum_fail");
                    throw new IOException("Checksum failed: " + id);
                }
            }`,
`            if (!isManifest) {
                String expectedChecksum = Objects.requireNonNullElse(checksumRes, "");
                if (!expectedChecksum.isEmpty()) {
                    if (CryptoCipher.isValidSessionKey(sessionKey)) {
                        CryptoCipher.decryptFile(downloaded, publicKey, sessionKey);
                        expectedChecksum = CryptoCipher.decryptChecksum(checksumRes, publicKey);
                    }
                    checksum = CryptoCipher.calcChecksum(downloaded);
                    CryptoCipher.logChecksumInfo("Calculated checksum", checksum);
                    CryptoCipher.logChecksumInfo("Expected checksum", expectedChecksum);
                    if (!expectedChecksum.equalsIgnoreCase(checksum)) {
                        logger.error("Checksum mismatch");
                        logger.debug("Expected: " + expectedChecksum + ", Got: " + checksum);
                        this.sendStats("checksum_fail");
                        throw new IOException("Checksum failed: " + id);
                    }
                } else {
                    checksum = CryptoCipher.calcChecksum(downloaded);
                    CryptoCipher.logChecksumInfo("Calculated checksum (no verification required)", checksum);
                }
            }`
  ]
]);

console.log('[patch-capgo] Concluído com sucesso!');
