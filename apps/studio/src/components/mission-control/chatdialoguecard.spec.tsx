import { render, screen, fireEvent } from '@testing-library/react';
import { ChatDialogueCard } from './ChatDialogueCard';

describe('ChatDialogueCard', () => {
  it('renders short message without expand button', () => {
    render(
      <ChatDialogueCard
        id="c-1"
        senderId="sdd-orchestrator"
        senderName="Clara"
        senderColor="#10b981"
        receiverId="sdd-reviewer"
        receiverName="Argus"
        receiverColor="#06b6d4"
        text="Tarea completada con éxito."
        badge="REVIEW"
        gateId="gate-b"
        seqNumber={1}
      />
    );

    expect(screen.getByText('Clara')).toBeInTheDocument();
    expect(screen.getByText('Argus')).toBeInTheDocument();
    expect(screen.getByText('Tarea completada con éxito.')).toBeInTheDocument();
    expect(screen.getByText('GATE-B')).toBeInTheDocument();
    expect(screen.getByText('REVIEW')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('Mostrar más')).not.toBeInTheDocument();
  });

  it('collapses long text by default and allows expanding/collapsing', () => {
    const longText =
      'Esta es una respuesta detallada del agente sobre el estado de la arquitectura. ' +
      'Contiene múltiples oraciones y especificaciones técnicas que ocupan más de ciento cincuenta caracteres. ' +
      'Debe estar contraída por defecto y ofrecer el botón para desplegar el contenido completo.';

    render(
      <ChatDialogueCard
        id="c-2"
        senderId="sdd-architect"
        senderName="Daedalus"
        text={longText}
        seqNumber={42}
      />
    );

    expect(screen.getByText('Daedalus')).toBeInTheDocument();
    const expandBtn = screen.getByText('Mostrar más');
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByText('Mostrar menos')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mostrar menos'));
    expect(screen.getByText('Mostrar más')).toBeInTheDocument();
  });

  it('triggers onClick handler when card is clicked', () => {
    const onClick = vi.fn();
    render(
      <ChatDialogueCard
        id="c-3"
        senderName="Clara"
        text="Prueba de clic"
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText('Prueba de clic'));
    expect(onClick).toHaveBeenCalled();
  });
});
