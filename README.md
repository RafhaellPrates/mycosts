# MyCosts

App web mobile-first para consultar e lancar gastos na minha planilha de controle financeiro (Excel no OneDrive), sem abrir a planilha.

## Arquitetura

```
iPhone (Safari)
   |  HTTPS
   v
Front: React + TypeScript (Vite)  -> Vercel
   |  JSON (API propria)
   v
Back: Node + Express + TypeScript -> Render
   |  Microsoft Graph API (OAuth2, refresh token)
   v
OneDrive -> planilha.xlsx (Tabela do Excel)
```

## Stack

- **Front:** React, TypeScript, Vite
- **Back:** Node.js, Express, TypeScript
- **Dados:** Microsoft Graph API (endpoints de Excel)
- **Auth do app:** senha + JWT

## Status

Em planejamento. Acompanhe pelas [issues](../../issues).
