# ADR-002: GitHub App authentication

Status: accepted  
Date: 2026-08-25

## Context
The product needs user identity and read-only access to public GitHub data. Security and user trust require minimum privileges.

## Decision
Use a GitHub App with short-lived credentials and fine-grained read-only permissions. MVP will not request repository or issue write access.

## Consequences
Safer authorization and future webhook support. Installation and token lifecycle are more complex than a simple personal token and require dedicated integration tests.
