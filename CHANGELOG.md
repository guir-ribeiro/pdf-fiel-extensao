# Changelog

## 1.0.2

- Novo nome: **Printly — páginas inteiras em PDF**.
- Nome atualizado no popup, no manifesto, na documentação e no repositório.
- ZIP instalável e artefato do CI passam a usar o prefixo `printly`.
- Preferências e atalho de captura preservados ao atualizar a instalação existente.

## 1.0.1

### Corrigido

- Restauração aguardada dos estilos, atributos e rolagem, também após falhas.
- Remoção da emulação e desconexão do depurador antes do download.
- Liberação de Blobs por download concluído, interrompido ou cancelado,
  sem encerrar downloads demorados após 30 segundos.
- Data e hora com fuso e sanitização de nomes de arquivo.
- Validação compartilhada de preferências e exibição de falhas no popup.
- Fechamento do stream de PDF após falha de leitura.

### Adicionado

- Licença MIT, READMEs em português e inglês, privacidade, contribuição,
  código de conduta e canal de segurança.
- Testes sem dependências, verificação estática e CI com ZIP instalável.
- Templates de issues e pull requests.
- Versão mínima explícita do Chrome e link para o repositório.

## 1.0.0

- Captura via `Page.printToPDF` com mídia de tela.
- Largura real, folha única e A4, carimbo configurável e atalho de captura.
