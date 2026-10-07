import mongoose from "mongoose";
import dns from "node:dns";

const dnsPromises = dns.promises;

// Reliable public DNS
dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);

function maskUri(uri) {
  try {
    const u = new URL(uri);

    if (u.username) u.username = "***";
    if (u.password) u.password = "***";

    return u.toString();
  } catch {
    return "<invalid MongoDB URI>";
  }
}

function getUri() {
  const direct = process.env.MONGODB_DIRECT_URI?.trim();
  const srv = process.env.MONGODB_URI?.trim();

  if (direct) {
    return {
      uri: direct,
      source: "MONGODB_DIRECT_URI",
    };
  }

  if (srv) {
    return {
      uri: srv,
      source: "MONGODB_URI",
    };
  }

  throw new Error(
    "No MongoDB URI found. Please set MONGODB_URI in Backend/.env"
  );
}

function validateUri(uri) {
  if (
    !uri.startsWith("mongodb://") &&
    !uri.startsWith("mongodb+srv://")
  ) {
    throw new Error(
      "MongoDB URI must start with mongodb:// or mongodb+srv://"
    );
  }
}

/**
 * Convert:
 *
 * mongodb+srv://user:password@cluster.mongodb.net/db
 *
 * into:
 *
 * mongodb://user:password@node1:27017,node2:27017,node3:27017/db
 *
 * This avoids the MongoDB driver's TXT DNS lookup.
 */
async function convertSrvToStandardUri(srvUri) {
  const parsed = new URL(srvUri);

  const hostname = parsed.hostname;

  const srvName = `_mongodb._tcp.${hostname}`;

  console.log(`Resolving MongoDB SRV records: ${srvName}`);

  const records = await dnsPromises.resolveSrv(srvName);

  if (!records || records.length === 0) {
    throw new Error(
      `No MongoDB Atlas SRV records found for ${hostname}`
    );
  }

  // Sort by priority/weight
  records.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    return b.weight - a.weight;
  });

  const hosts = records
    .map((record) => `${record.name.replace(/\.$/, "")}:${record.port}`)
    .join(",");

  // Keep username/password exactly as encoded in original URL.
  const userInfo = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";

  // Use database from URI; fallback to hisabkitab.
  let database = parsed.pathname;

  if (!database || database === "/") {
    database = "/hisabkitab";
  }

  // Preserve existing query parameters except appName is harmless.
  const params = new URLSearchParams(parsed.search);

  // Standard Atlas connection settings.
  params.set("tls", "true");
  params.set("authSource", "admin");
  params.set("retryWrites", "true");
  params.set("w", "majority");

  // Remove parameters that belong specifically to SRV discovery.
  params.delete("srvServiceName");
  params.delete("srvMaxHosts");

  const standardUri =
    `mongodb://${userInfo}${hosts}${database}?${params.toString()}`;

  console.log(
    `MongoDB SRV converted to standard seed-list connection (${records.length} nodes).`
  );

  return standardUri;
}

async function connectWithUri(uri, source) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 30000,

    family: 4,

    maxPoolSize: 10,
    minPoolSize: 0,

    retryWrites: true,

    tls: true,

    authSource: "admin",
  });

  console.log(
    `MongoDB connected successfully (${source})`
  );
}

export async function connectDB() {
  const { uri, source } = getUri();

  validateUri(uri);

  try {
    /*
     * If user provides a normal mongodb:// URI,
     * use it directly.
     */
    if (uri.startsWith("mongodb://")) {
      await connectWithUri(uri, source);
      return;
    }

    /*
     * If user provides mongodb+srv://,
     * manually resolve SRV and convert it to a
     * standard mongodb:// seed-list URI.
     *
     * This bypasses the driver's queryTxt step.
     */
    if (uri.startsWith("mongodb+srv://")) {
      console.log(
        "MongoDB Atlas SRV URI detected."
      );

      console.log(
        "Resolving Atlas nodes manually to bypass TXT DNS lookup..."
      );

      const standardUri = await convertSrvToStandardUri(uri);

      await connectWithUri(
        standardUri,
        `${source} → manual SRV seed list`
      );

      return;
    }
  } catch (error) {
    const message = error?.message || String(error);

    console.error("");
    console.error("----------------------------------------");
    console.error("MONGODB CONNECTION ERROR");
    console.error("----------------------------------------");
    console.error(message);
    console.error("Configured URI:", maskUri(uri));
    console.error("----------------------------------------");
    console.error("");

    throw new Error(
      `MongoDB connection failed: ${message}`
    );
  }
}