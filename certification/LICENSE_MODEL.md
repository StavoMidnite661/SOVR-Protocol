# SOVR Protocol — Enterprise Licensing Package

**Version:** v0.6.0  
**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `6e97ae164fa847ca4f54d99250a505752d033e9a73c2650c70a1d11c5f1f1015`  

---

## License Model

**Current License:** Proprietary — All rights reserved  
**Commercial License:** Available upon request  
**Open Source:** No — SOVR is proprietary software  
**Specification:** Open — YAML constitutional specification is publicly available

---

## LICENSE_MODEL.md

### License Tiers

| Tier | Use Case | License Type | Fee Structure |
|---|---|---|---|
| Evaluation | Proof of concept, demo | Free (restricted) | No fee |
| Development | Internal development, testing | Commercial | Per-seat annual |
| Production | Live financial transactions | Commercial | Per-transaction or annual |
| Enterprise | Multi-region, HA, support | Commercial | Enterprise agreement |
| OEM | Embedded in third-party product | Commercial | OEM agreement |

### License Restrictions

1. **No redistribution** without written consent
2. **No reverse engineering** permitted
3. **No modification** of constitutional specification without amendment process
4. **No sublicensing** without agreement
5. **No use** in nuclear, weapons, or sanctions-affected jurisdictions

### License Grant

Subject to payment of fees and compliance with terms, Licensor grants Licensee:
- Non-exclusive, non-transferable license to use Software
- Right to deploy in production environment
- Right to receive updates and support (per SLA)
- Right to use documentation for internal purposes

---

## COMMERCIAL_LICENSE_TEMPLATE.md

### Commercial License Agreement

**Parties:**
- **Licensor:** SOVR Protocol Foundation (or assignee)
- **Licensee:** [Institution Name]

**Grant:**
- Non-exclusive, worldwide, royalty-bearing license
- Term: [12/24/36] months
- Territory: [Global / Specific countries]

**Fees:**
- License fee: $[amount] per [deployment/transaction/user]
- Support fee: $[amount] annually (optional)
- Implementation fee: $[amount] (optional)

**Warranties:**
- Software conforms to documentation for [90] days
- No warranty of fitness for particular purpose
- No warranty of merchantability

**Limitation of Liability:**
- Liability limited to fees paid in preceding 12 months
- No liability for indirect, incidental, or consequential damages

**Termination:**
- Material breach: 30-day cure period
- Insolvency: immediate termination
- Post-termination: cease use, destroy copies

---

## ENTERPRISE_SUPPORT.md

### Support Tiers

| Tier | Response Time | Coverage | Price |
|---|---|---|---|
| Bronze | 8 business hours | Business hours, M-F | $25,000/year |
| Silver | 4 business hours | Business hours, M-F | $50,000/year |
| Gold | 1 business hour | 24/7 | $100,000/year |
| Platinum | 15 minutes | 24/7 | $200,000/year |

### Support Scope

**Included:**
- Bug fixes and patches
- Security updates
- Documentation
- Email support
- Remote debugging (Gold/Platinum)

**Not Included:**
- Custom development
- Training (separate agreement)
- On-site support (separate agreement)
- Third-party integrations

### Support Channels

| Channel | Purpose | Availability |
|---|---|---|
| Email | General support | All tiers |
| Phone | Urgent issues | Gold/Platinum |
| Slack | Real-time chat | Gold/Platinum |
| Portal | Ticket tracking | All tiers |
| Documentation | Self-service | All tiers |

---

## SLA.md

### Service Level Agreement

**Uptime Commitment:**

| Tier | Uptime Target | Measurement | Remediation |
|---|---|---|---|
| Bronze | 99.5% | Monthly | Service credit |
| Silver | 99.9% | Monthly | Service credit |
| Gold | 99.95% | Monthly | Service credit + termination right |
| Platinum | 99.99% | Monthly | Service credit + termination right |

**Service Credits:**

| Uptime Achieved | Credit Percentage |
|---|---|
| ≥ 99.99% | 0% |
| 99.9% – 99.99% | 10% |
| 99.5% – 99.9% | 25% |
| < 99.5% | 50% |

**Exclusions:**
- Scheduled maintenance (with 48-hour notice)
- Force majeure events
- Licensee-caused outages
- Third-party service failures (PostgreSQL, Kafka, Redis)

---

## MAINTENANCE_POLICY.md

### Maintenance Releases

| Release Type | Frequency | Contents | Support |
|---|---|---|---|
| Patch | As needed | Bug fixes, security | All active licenses |
| Minor | Quarterly | Features, improvements | Gold/Platinum |
| Major | Annually | Architecture changes | Enterprise only |

### Maintenance Process

1. **Patch:** Critical security/bug fixes released immediately
2. **Minor:** Quarterly releases with new features
3. **Major:** Annual releases with breaking changes
4. **Security:** Emergency releases for critical vulnerabilities

### End-of-Life Policy

| Version | Release Date | EOL Date | Support |
|---|---|---|---|
| 0.9.x | 2026-07-25 | 2027-07-25 | Active |
| 0.8.x | [Previous] | [Previous + 12 months] | Maintenance only |
| 0.7.x | [Previous] | [Previous + 12 months] | End-of-life |

---

## VERSION_SUPPORT_MATRIX.md

### Version Support

| Version | Status | Security Updates | Bug Fixes | Features | Support |
|---|---|---|---|---|---|
| 1.0.0 | Planned | Yes | Yes | Yes | Enterprise |
| 0.9.x | Active | Yes | Yes | Yes | All tiers |
| 0.8.x | Maintenance | Yes | Yes | No | Bronze/Silver |
| 0.7.x | End-of-life | No | No | No | None |

### Upgrade Path

```
0.9.x → 1.0.0 (Q4 2026)
  - Breaking: Generated artifact wiring
  - Breaking: State machine coverage expansion
  - Non-breaking: Security patches
  - Migration guide provided
```

---

*Licensing package generated for commercial distribution. No legal advice provided. Consult qualified legal counsel before executing agreements.*
