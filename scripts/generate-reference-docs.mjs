#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const ROOT = path.resolve("D:/sovr-financial-os-protocol-v1.0.0/SOVR-Protocol");
const GENERATED = path.join(ROOT, "generated");
const REGISTRIES = path.join(GENERATED, "registries");
const DOCS = path.join(ROOT, "docs", "generated");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function escMd(str) {
  return String(str).replace(/[|\\]/g, (c) => `\\${c}`);
}

function mdTable(headers, rows) {
  const headerRow = `| ${headers.map(escMd).join(" | ")} |`;
  const sepRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map((row) => {
    const cells = headers.map((h) => {
      const val = row[h] ?? "";
      return escMd(String(val)).replace(/\n/g, " ");
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [headerRow, sepRow, ...bodyRows].join("\n");
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Load registries
// ---------------------------------------------------------------------------
const commands = readJson(path.join(REGISTRIES, "commands.registry.json"));
const events = readJson(path.join(REGISTRIES, "events.registry.json"));
const capabilities = readJson(path.join(REGISTRIES, "capabilities.registry.json"));
const projections = readJson(path.join(REGISTRIES, "projections.registry.json"));
const machines = readJson(path.join(REGISTRIES, "machines.registry.json"));
const registryManifest = readJson(path.join(REGISTRIES, "registry.manifest.json"));
const compilerManifest = readJson(path.join(GENERATED, "compiler-manifest.yaml"));

// ---------------------------------------------------------------------------
// Load domains
// ---------------------------------------------------------------------------
const domainsDir = path.join(ROOT, "domains");
const domainFiles = fs
  .readdirSync(domainsDir)
  .filter((f) => f.endsWith(".yaml"))
  .sort();

const domains = domainFiles.map((f) => {
  const data = readYaml(path.join(domainsDir, f));
  const d = data.domain || {};
  return {
    name: d.name || path.basename(f, ".yaml"),
    version: d.version || "",
    description: (d.description || "").replace(/\n/g, " ").trim(),
    constitutionalReferences: d.constitutional_references || {},
  };
});

// ---------------------------------------------------------------------------
// Genesis root hash (from audit replay certification)
// ---------------------------------------------------------------------------
let genesisRootHash = "unavailable";
try {
  const replayCert = readJson(
    path.join(GENERATED, "audit", "phase10e10-replay-certification.json")
  );
  genesisRootHash = replayCert.genesis_root_hash || genesisRootHash;
} catch {
  try {
    const mutationCert = readJson(
      path.join(GENERATED, "audit", "phase10e9-mutation-policy-validation.json")
    );
    genesisRootHash = mutationCert.genesis_root_hash || genesisRootHash;
  } catch {
    // keep unavailable
  }
}

const timestamp = new Date().toISOString();
const buildHash = compilerManifest.build_hash || "unknown";
const protocolVersion = compilerManifest.protocol_version || "unknown";
const compilerVersion = compilerManifest.compiler_version || "unknown";

// ---------------------------------------------------------------------------
// Helper: write file
// ---------------------------------------------------------------------------
function writeFile(name, content) {
  const filePath = path.join(DOCS, name);
  fs.writeFileSync(filePath, content.trim() + "\n", "utf8");
}

// ===========================================================================
// 1. COMMAND_REFERENCE.md
// ===========================================================================
{
  const entries = Object.values(commands.entries).sort((a, b) =>
    a.command_name.localeCompare(b.command_name)
  );

  const rows = entries.map((e) => ({
    Command: e.command_name,
    Domain: e.domain,
    Version: e.version,
    Authorization: [
      e.authorization_requirements?.identity === "required" ? "Identity" : "",
      e.authorization_requirements?.capability ? "Capability" : "",
      e.authorization_requirements?.policy ? "Policy" : "",
    ]
      .filter(Boolean)
      .join(" + ") || "None",
    "Lifecycle Exempt": e.lifecycle_exempt ? "Yes" : "No",
    Description: (e.description || e.command_name).replace(/\n/g, " "),
  }));

  const total = entries.length;
  const exemptCount = entries.filter((e) => e.lifecycle_exempt).length;
  const coveredCount = total - exemptCount;

  const md = [
    `# Command Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: generated/registries/commands.registry.json`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Commands | ${total} |`,
    `| Lifecycle Covered | ${coveredCount} |`,
    `| Lifecycle Exempt | ${exemptCount} |`,
    `| ABI Version | ${commands.abi} |`,
    ``,
    `## Commands`,
    ``,
    mdTable(
      ["Command", "Domain", "Version", "Authorization", "Lifecycle Exempt", "Description"],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("COMMAND_REFERENCE.md", md);
}

// ===========================================================================
// 2. EVENT_REFERENCE.md
// ===========================================================================
{
  const entries = Object.values(events.entries).sort((a, b) =>
    a.event_name.localeCompare(b.event_name)
  );

  const rows = entries.map((e) => ({
    Event: e.event_name,
    Domain: e.domain,
    Amendment: e.amendment || "",
    TriggeredBy: e.triggered_by || "",
    Triggers: Array.isArray(e.triggers) ? e.triggers.join(", ") : "",
    Description: (e.description || e.event_name).replace(/\n/g, " "),
  }));

  const md = [
    `# Event Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: generated/registries/events.registry.json`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Events | ${entries.length} |`,
    `| ABI Version | ${events.abi} |`,
    ``,
    `## Events`,
    ``,
    mdTable(
      ["Event", "Domain", "Amendment", "TriggeredBy", "Triggers", "Description"],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("EVENT_REFERENCE.md", md);
}

// ===========================================================================
// 3. DOMAIN_REFERENCE.md
// ===========================================================================
{
  const rows = domains.map((d) => ({
    Domain: d.name,
    Version: d.version,
    Description: d.description,
    Invariants: Array.isArray(d.constitutionalReferences.invariants)
      ? d.constitutionalReferences.invariants.join(", ")
      : "",
    "Conflict Rank": d.constitutionalReferences.conflict_resolution_rank ?? "",
  }));

  const md = [
    `# Domain Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: domains/*.yaml`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Domains | ${domains.length} |`,
    ``,
    `## Domains`,
    ``,
    mdTable(
      ["Domain", "Version", "Description", "Invariants", "Conflict Rank"],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("DOMAIN_REFERENCE.md", md);
}

// ===========================================================================
// 4. CAPABILITY_REFERENCE.md
// ===========================================================================
{
  const entries = Object.values(capabilities.entries).sort((a, b) =>
    a.capability_id.localeCompare(b.capability_id)
  );

  const rows = entries.map((e) => ({
    Capability: e.capability_id,
    Domain: e.domain,
    Action: e.action,
    RiskLevel: e.risk_level,
    ResourceType: e.resource_type,
    Delegable: e.delegable ? "Yes" : "No",
    "Governance Approval": e.governance_approval_required ? "Yes" : "No",
    Description: (e.description || e.capability_id).replace(/\n/g, " "),
  }));

  const md = [
    `# Capability Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: generated/registries/capabilities.registry.json`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Capabilities | ${entries.length} |`,
    `| ABI Version | ${capabilities.abi} |`,
    ``,
    `## Capabilities`,
    ``,
    mdTable(
      [
        "Capability",
        "Domain",
        "Action",
        "RiskLevel",
        "ResourceType",
        "Delegable",
        "GovernanceApproval",
        "Description",
      ],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("CAPABILITY_REFERENCE.md", md);
}

// ===========================================================================
// 5. PROJECTION_REFERENCE.md
// ===========================================================================
{
  const entries = Object.values(projections.entries).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const rows = entries.map((e) => ({
    Projection: e.name,
    "Projection ID": e.projection_id || "",
    Domain: e.source_domain,
    "Rebuild Strategy": e.rebuild_strategy,
    "Source Events": Array.isArray(e.source_events)
      ? e.source_events.slice(0, 5).join(", ") +
        (e.source_events.length > 5 ? " ..." : "")
      : "",
    Caching: e.caching?.enabled ? `TTL=${e.caching.ttl_seconds}s` : "No",
    Description: (e.description || e.name).replace(/\n/g, " "),
  }));

  const md = [
    `# Projection Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: generated/registries/projections.registry.json`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Projections | ${entries.length} |`,
    `| ABI Version | ${projections.abi} |`,
    ``,
    `## Projections`,
    ``,
    mdTable(
      [
        "Projection",
        "ProjectionID",
        "Domain",
        "RebuildStrategy",
        "SourceEvents",
        "Caching",
        "Description",
      ],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("PROJECTION_REFERENCE.md", md);
}

// ===========================================================================
// 6. STATE_MACHINE_REFERENCE.md
// ===========================================================================
{
  const entries = Object.values(machines.entries).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const rows = entries.map((e) => {
    const transitionCount = Array.isArray(e.transitions) ? e.transitions.length : 0;
    return {
      "State Machine": e.id,
      Domain: e.domain,
      "Initial State": e.initial_state,
      States: Array.isArray(e.states) ? e.states.join(", ") : "",
      "Final States": Array.isArray(e.final_states)
        ? e.final_states.join(", ")
        : "—",
      Transitions: transitionCount,
    };
  });

  const md = [
    `# State Machine Reference`,
    ``,
    `> **Compiler-generated reference documentation**`,
    `> Generated at: ${timestamp}`,
    `> Source: generated/registries/machines.registry.json`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total State Machines | ${entries.length} |`,
    `| ABI Version | ${machines.abi} |`,
    ``,
    `## State Machines`,
    ``,
    mdTable(
      [
        "StateMachine",
        "Domain",
        "InitialState",
        "States",
        "FinalStates",
        "Transitions",
      ],
      rows
    ),
    ``,
  ].join("\n");

  writeFile("STATE_MACHINE_REFERENCE.md", md);
}

// ===========================================================================
// 7. BUILD_IDENTITY.md
// ===========================================================================
{
  const registryCounts = registryManifest.registries || {};
  const md = [
    `# Build Identity`,
    ``,
    `> **Compiler-generated build identity record**`,
    `> Generated at: ${timestamp}`,
    ``,
    `## Build Metadata`,
    ``,
    `| Property | Value |`,
    `| --- | --- |`,
    `| Build Hash | ${escMd(buildHash)} |`,
    `| Protocol Version | ${escMd(protocolVersion)} |`,
    `| Implementation Version (Compiler) | ${escMd(compilerVersion)} |`,
    `| Genesis Root Hash | ${escMd(genesisRootHash)} |`,
    `| IR Hash | ${escMd(compilerManifest.ir_hash || "unknown")} |`,
    ``,
    `## Registry Counts`,
    ``,
    `| Registry | Count |`,
    `| --- | --- |`,
    ...Object.keys(registryCounts)
      .sort()
      .map((k) => `| ${escMd(k)} | ${registryCounts[k].entry_count} |`),
    ``,
  ].join("\n");

  writeFile("BUILD_IDENTITY.md", md);
}

console.log("Reference documentation generated successfully.");
console.log(`Output directory: ${DOCS}`);
