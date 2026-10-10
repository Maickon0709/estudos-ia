"""Dublês de teste compartilhados (sem Supabase e sem rede)."""


class MensagemRepoFalso:
    def __init__(self):
        self.itens = []

    def listar_recentes(self, categoria_id, limite):
        daquela = [m for m in self.itens if m["categoria_id"] == categoria_id]
        return daquela[-limite:]

    def criar_par(self, categoria_id, pergunta, resposta):
        pergunta_salva = {"categoria_id": categoria_id, "papel": "user", "conteudo": pergunta}
        resposta_salva = {"categoria_id": categoria_id, "papel": "assistant", "conteudo": resposta}
        self.itens += [pergunta_salva, resposta_salva]
        return [pergunta_salva, resposta_salva]


class LLMFalso:
    def __init__(self, resposta="Resposta da IA."):
        self.resposta = resposta
        self.erro = None
        self.chamadas = []

    def responder(self, mensagens):
        self.chamadas.append(mensagens)
        if self.erro is not None:
            raise self.erro
        return self.resposta

    def responder_stream(self, mensagens):
        """Entrega a resposta em pedaços de até 5 caracteres; o erro sai no meio."""
        self.chamadas.append(mensagens)
        for i in range(0, len(self.resposta), 5):
            if self.erro is not None and i >= 5:
                raise self.erro
            yield self.resposta[i:i + 5]
        if self.erro is not None:
            raise self.erro
