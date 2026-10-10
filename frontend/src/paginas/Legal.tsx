import { Link } from 'react-router'
import { Documento, PaginaPublica } from '@/components/PaginaPublica'
import { REPOSITORIO } from '@/components/Rodape'
import { LINK_EXTERNO } from '@/lib/seguranca'
import { useTitulo } from '@/lib/titulo'

// Mesma data de TERMOS_VERSAO em app/routes/auth.py: mudou o texto, mude as duas.
export const VERSAO_TERMOS = '10/10/2026'

function Contato() {
  return (
    <a href={`${REPOSITORIO}/issues`} {...LINK_EXTERNO} className="text-primary underline underline-offset-2">
      página de issues do repositório no GitHub
    </a>
  )
}

export function PaginaTermos() {
  useTitulo('Termos de Uso', 'Termos de Uso do Estudos IA: o que é o serviço, regras de uso, limites da inteligência artificial e como excluir sua conta.')
  return (
    <PaginaPublica>
      <Documento titulo="Termos de Uso" versao={VERSAO_TERMOS}>
        <p>
          Estes termos explicam como usar o Estudos IA. Ao criar uma conta, você declara que leu e concorda com eles
          e com a <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
        </p>

        <h2>1. O que é o serviço</h2>
        <p>
          O Estudos IA é uma plataforma de estudos com uma tutora de inteligência artificial. Ela conversa com você,
          pesquisa materiais reais na internet, monta trilhas de estudo, cria exercícios e flashcards e acompanha seu progresso.
          É um <strong>projeto de portfólio, sem fins comerciais</strong>, oferecido gratuitamente e no estado em que se encontra.
        </p>

        <h2>2. Sua conta</h2>
        <ul>
          <li>Use um e-mail válido e uma senha só sua. Você é responsável pelo que acontece na sua conta.</li>
          <li>Menores de 18 anos devem usar o serviço com autorização de um responsável.</li>
          <li>Você pode excluir sua conta quando quiser, na página <strong>Conta</strong>. A exclusão apaga todos os seus dados e não pode ser desfeita.</li>
        </ul>

        <h2>3. Sobre a inteligência artificial</h2>
        <ul>
          <li>As respostas, explicações, exercícios e correções são geradas por IA e <strong>podem conter erros</strong>. Confira informações importantes em fontes confiáveis.</li>
          <li>O serviço não substitui professores, cursos ou orientação profissional.</li>
          <li>Os links e vídeos indicados são verificados automaticamente para existir e estar no ar, mas o conteúdo deles é de responsabilidade de quem os publicou.</li>
        </ul>

        <h2>4. Uso permitido</h2>
        <p>Não é permitido usar o serviço para:</p>
        <ul>
          <li>enviar conteúdo ilegal, ofensivo ou que viole direitos de terceiros;</li>
          <li>tentar acessar dados de outros usuários, burlar limites ou atacar o sistema;</li>
          <li>usar automações para gerar volume excessivo de pedidos à IA ou à pesquisa.</li>
        </ul>
        <p>Contas que violem estas regras podem ser suspensas ou excluídas.</p>

        <h2>5. Disponibilidade</h2>
        <p>
          Por ser um projeto de portfólio que usa planos gratuitos de serviços externos, o Estudos IA pode ficar fora do ar,
          ter limites de uso ou mudar sem aviso prévio.
        </p>

        <h2>6. Mudanças nestes termos</h2>
        <p>Se os termos mudarem, a data da versão no topo desta página também muda.</p>

        <h2>7. Contato</h2>
        <p>Dúvidas ou pedidos: use a <Contato />.</p>
      </Documento>
    </PaginaPublica>
  )
}

export function PaginaPrivacidade() {
  useTitulo('Política de Privacidade', 'Como o Estudos IA trata seus dados pessoais (LGPD): o que guardamos, quem recebe, por quanto tempo e como baixar ou apagar tudo.')
  return (
    <PaginaPublica>
      <Documento titulo="Política de Privacidade" versao={VERSAO_TERMOS}>
        <p>
          Esta política explica quais dados o Estudos IA trata, para quê e quais são os seus direitos, de acordo com a
          Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>

        <h2>1. Dados que guardamos</h2>
        <ul>
          <li><strong>Cadastro:</strong> e-mail, nome (opcional), senha (guardada pelo serviço de login em formato protegido, nunca em texto puro) e a data em que você aceitou estes termos.</li>
          <li><strong>Estudos:</strong> categorias, mensagens trocadas com a tutora, trilhas, etapas, materiais, exercícios e suas respostas, flashcards, simulados, revisões, metas e o tempo cronometrado.</li>
          <li><strong>Materiais que você envia</strong> (PDF, Word, PowerPoint, texto): guardamos só o <strong>texto</strong> extraído, dividido em trechos, e o nome do arquivo. O arquivo original não é guardado. Apagar o material apaga todo o texto dele.</li>
        </ul>

        <h2>2. Para que usamos</h2>
        <p>
          Só para fazer o serviço funcionar: montar suas trilhas, corrigir exercícios, agendar revisões e mostrar seu progresso.
          <strong> Não vendemos, não alugamos e não usamos seus dados para publicidade.</strong>
        </p>

        <h2>3. Serviços de terceiros que recebem dados</h2>
        <ul>
          <li><strong>Supabase:</strong> banco de dados e login. Guarda tudo o que está no item 1.</li>
          <li><strong>Groq (IA):</strong> recebe o texto das conversas, das etapas, das suas respostas discursivas e os trechos dos seus materiais ligados à pergunta para gerar respostas, exercícios, flashcards e correções.</li>
          <li><strong>Tavily (pesquisa na web):</strong> recebe o objetivo de estudo que você descreve ao montar uma trilha.</li>
          <li><strong>YouTube Data API (Google):</strong> recebe apenas os identificadores dos vídeos encontrados, para confirmar que existem.</li>
        </ul>
        <p>Esses serviços podem processar dados fora do Brasil. Evite escrever dados pessoais sensíveis nas conversas.</p>

        <h2>4. O que fica no seu navegador</h2>
        <p>
          Não usamos cookies de rastreamento nem ferramentas de análise. Usamos apenas <strong>dois cookies
          essenciais de sessão</strong>, que mantêm você logado: um de acesso (vale cerca de 1 hora) e um de renovação
          (vale até 30 dias). Eles são protegidos (HttpOnly e Secure): nem o próprio site consegue lê-los pelo
          navegador, e são apagados quando você sai da conta.
        </p>
        <p>
          No armazenamento local do navegador ficam só preferências: o tema (claro ou escuro), o cronômetro em
          andamento, as respostas de um simulado ainda não entregue, quais dicas do tutorial você já viu e um
          indicador de que há uma sessão aberta. Nada disso é enviado a terceiros.
        </p>

        <h2>5. Por quanto tempo</h2>
        <p>Enquanto sua conta existir. Ao excluí-la, todos os dados de estudo são apagados na hora, sem possibilidade de recuperação.</p>

        <h2>6. Seus direitos</h2>
        <ul>
          <li><strong>Acesso e portabilidade:</strong> baixe todos os seus dados em um arquivo, na página Conta.</li>
          <li><strong>Exclusão:</strong> exclua sua conta e todos os dados, na página Conta.</li>
          <li><strong>Correção e outras solicitações:</strong> pelo contato abaixo.</li>
        </ul>

        <h2>7. Segurança</h2>
        <p>
          Cada usuário só acessa os próprios dados (regras de segurança no próprio banco), a conexão é criptografada e
          as chaves dos serviços nunca ficam no navegador.
        </p>

        <h2>8. Contato</h2>
        <p>Para exercer seus direitos ou tirar dúvidas: use a <Contato />.</p>
      </Documento>
    </PaginaPublica>
  )
}
