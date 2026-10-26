import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { QuestionForm } from './QuestionForm';

type QuestionItem = Extract<TimelineItem, { kind: 'question' }>;
const author = { agent: 'sdd-orchestrator', parentToolUseId: null };
const single = { question: '¿Qué modo?', header: 'Modo', options: [{ label: 'lite', description: 'un actor' }, { label: 'full' }], multiSelect: false };
const multi = { question: '¿Qué áreas?', header: 'Áreas', options: [{ label: 'web' }, { label: 'puente' }, { label: 'protocolo' }], multiSelect: true };
const item = (over: Partial<QuestionItem> = {}): QuestionItem => ({ kind: 'question', id: 'q1', seq: 4, author, questions: [single], outcome: 'pending', ...over });
const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);
const send = () => screen.getByRole('button', { name: 'Enviar respuesta' });

describe('QuestionForm', () => {
  it('asks in the agent name and keeps send disabled until every question has an answer', () => {
    wrap(<QuestionForm item={item({ questions: [single, multi] })} onAnswer={vi.fn()} />);
    expect(screen.getByText('Clara te hace una pregunta')).toBeInTheDocument();
    expect(send()).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/lite/));
    expect(send()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('web'));
    expect(send()).toBeEnabled();
  });

  it('sends a single-choice answer', async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    wrap(<QuestionForm item={item()} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByLabelText(/full/));
    fireEvent.click(send());
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith([{ question: '¿Qué modo?', values: ['full'] }], false));
  });

  it('single choice keeps one value when the dev changes their mind', async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    wrap(<QuestionForm item={item()} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByLabelText(/lite/));
    fireEvent.click(screen.getByLabelText(/full/));
    fireEvent.click(send());
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith([{ question: '¿Qué modo?', values: ['full'] }], false));
  });

  it('sends several values for a multiple-choice question and can untick one', async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    wrap(<QuestionForm item={item({ questions: [multi] })} onAnswer={onAnswer} />);
    expect(screen.getByText('Podés elegir más de una')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('web'));
    fireEvent.click(screen.getByLabelText('puente'));
    fireEvent.click(screen.getByLabelText('web'));
    fireEvent.click(screen.getByLabelText('protocolo'));
    fireEvent.click(send());
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith([{ question: '¿Qué áreas?', values: ['puente', 'protocolo'] }], false));
  });

  it('sends a free-text answer and needs text to enable send', async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    wrap(<QuestionForm item={item()} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByLabelText('Otra respuesta', { selector: 'input[type="radio"]' }));
    expect(send()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Escribí tu respuesta'), { target: { value: '  modo híbrido ' } });
    expect(send()).toBeEnabled();
    fireEvent.click(send());
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith([{ question: '¿Qué modo?', values: ['modo híbrido'] }], false));
  });

  it('declines without answers', async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    wrap(<QuestionForm item={item()} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'No responder' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith([], true));
  });

  it('shows the send error and unlocks the form', async () => {
    wrap(<QuestionForm item={item()} onAnswer={() => Promise.reject(new Error('sin conexión'))} />);
    fireEvent.click(screen.getByLabelText(/lite/));
    fireEvent.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo enviar la respuesta: sin conexión');
    expect(send()).toBeEnabled();
  });

  it('shows the chosen answer once resolved and no longer offers the form', () => {
    wrap(<QuestionForm item={item({ outcome: 'answered', answers: [{ question: '¿Qué modo?', values: ['lite'] }] })} onAnswer={vi.fn()} />);
    expect(screen.getByText('lite')).toBeInTheDocument();
    expect(screen.getByText('Respondida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).toBeNull();
  });

  it.each([['declined', 'No respondiste'], ['cancelled', 'Cancelada']] as const)('marks a %s question', (outcome, text) => {
    wrap(<QuestionForm item={item({ outcome })} onAnswer={vi.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTestId('question-form')).toHaveAttribute('data-outcome', outcome);
  });
});
