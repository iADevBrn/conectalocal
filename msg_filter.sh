#!/bin/bash
case "$1" in
  "fix: move useEffect before early returns to fix React hooks rule; fix unused redirectTo param")
    echo "corr: move useEffect antes de returns antecipados para corrigir regra de hooks; corrige param redirectTo não usado"
    ;;
  "fix(lint): fix unused params, imports, and Date impurity warnings")
    echo "corr(lint): corrige params, imports não usados e avisos de Date impura"
    ;;
  "fix: export formatarMoeda from cliente.js for minhaConta page")
    echo "corr: exporta formatarMoeda de cliente.js para página minhaConta"
    ;;
  "feat(pwa): add PWA manifest, service worker, icons; feat(auth): customer login flow on landing/login pages")
    echo "feat(pwa): adiciona manifest PWA, service worker, ícones; feat(auth): fluxo login cliente no landing/login"
    ;;
  "feat(frontend): add customer auth context, login modal, minha conta page, and integrate with vitrine")
    echo "feat(frontend): adiciona contexto auth cliente, modal login, página minha conta, integra com vitrine"
    ;;
  "feat(db): add customer auth schema (clientes, enderecos, pedidos, fidelidade, favoritos) with RLS and RPC functions")
    echo "feat(db): adiciona schema auth cliente (clientes, enderecos, pedidos, fidelidade, favoritos) com RLS e RPCs"
    ;;
  *)
    cat
    ;;
esac
