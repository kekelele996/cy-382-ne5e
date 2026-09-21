import { useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { api } from '../api';

interface Props {
  tripId: number;
  expenseId: number;
  onDone: () => void;
}

/** 其他成员驳回存疑支出并填写原因。 */
export default function RejectButton({ tripId, expenseId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api(`/trips/${tripId}/expenses/${expenseId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      setOpen(false);
      setReason('');
      onDone();
    } catch (error) {
      Modal.error({ title: '驳回失败', content: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="small" danger onClick={() => setOpen(true)}>驳回</Button>
      <Modal
        title="驳回该支出"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={loading}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Input.TextArea
          rows={3}
          placeholder="请填写驳回原因（将通知登记人修改重提）"
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
