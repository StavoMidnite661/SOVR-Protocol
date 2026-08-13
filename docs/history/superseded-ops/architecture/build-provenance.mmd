flowchart LR
    subgraph Inputs["Input Frontier (38 YAML files)"]
        M0[00_protocol-manifest]
        C1[01_constitution]
        DM[02_domain-model]
        CMD[03_command-catalog]
        EVT[04_event-catalog]
        SM[05_state-machines]
        CAP[08_security-capabilities]
        SAG[09_saga-orchestration]
        OTH[Other specs...]
    end

    subgraph Compiler["Deterministic Compiler (R1-R10)"]
        PARSE[Parse + Validate]
        IR[Canonical IR<br/>536 nodes / 404 edges]
        GEN[Generators<br/>(11 deterministic)]
    end

    subgraph Artifacts["Generated Artifacts (69 files)"]
        MAN[compiler-manifest.yaml<br/>input_hashes + ir_hash + build_hash]
        BOOT[boot-attestation.json<br/>build_hash + boot_hash]
        CODE[Types, Commands, Events, OpenAPI, Prisma...]
    end

    subgraph Runtime["Runtime Server"]
        BOOT2[Boot Sequence 0-7]
        HEALTH["/health + /manifest + /boot-attestation"]
    end

    M0 & C1 & DM & CMD & EVT & SM & CAP & SAG & OTH --> PARSE
    PARSE --> IR
    IR --> GEN
    GEN --> MAN & BOOT & CODE

    MAN --> BOOT2
    BOOT --> HEALTH
    CODE --> BOOT2

    style MAN fill:#e8f5e9,stroke:#2e7d32
    style BOOT fill:#e8f5e9,stroke:#2e7d32
    style HEALTH fill:#fff3e0,stroke:#f57c00
    style IR fill:#e3f2fd,stroke:#1565c0
