# ADR-001: Modular monolith

Status: accepted  
Date: 2026-08-25

## Context
The product requires web delivery, GitHub integration, scoring, persistence, and background refreshes, but has no validated scale requiring microservices.

## Decision
Use a modular monolith with a separately runnable worker. Enforce module boundaries in code and tests.

## Consequences
Faster development, simpler transactions and operations, and lower cost. Independent scaling is limited; a module may be extracted later using measured bottlenecks and stable interfaces.
