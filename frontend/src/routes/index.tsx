import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  type User,
  type UserInput,
  bulkCreateUsers,
  bulkDeleteUsers,
  createUser,
  deleteUser,
  fetchUsers,
  getExportUrl,
  importUsersCsv,
  updateUser,
} from "../api/users";
import { Modal } from "../components/Modal";
import { EditIcon, TrashIcon } from "../components/icons";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

type ModalState =
  | { type: "add" }
  | { type: "edit"; user: User }
  | { type: "bulkAdd" }
  | { type: "import" }
  | { type: "confirmDelete"; id: number; name: string }
  | { type: "confirmBulkDelete" }
  | null;

interface UserFormModalProps {
  title: string;
  initial: UserInput;
  busy: boolean;
  error: string | null;
  submitClassName: string;
  onCancel: () => void;
  onSubmit: (input: UserInput) => void;
}

function UserFormModal({
  title,
  initial,
  busy,
  error,
  submitClassName,
  onCancel,
  onSubmit,
}: UserFormModalProps) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ name, email });
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <label className="field-label">
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field-label">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {error && <p className="error-box">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={submitClassName} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ConfirmModalProps {
  title: string;
  message: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmModal({ title, message, busy, error, onCancel, onConfirm }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="modal-message">{message}</p>
      {error && <p className="error-box">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

interface BulkAddModalProps {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (users: UserInput[]) => void;
}

function BulkAddModal({ busy, error, onCancel, onSubmit }: BulkAddModalProps) {
  const [value, setValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error("not an array");
      }
      setFormError(null);
      onSubmit(parsed);
    } catch {
      setFormError("Input must be a JSON array of {name, email} objects");
    }
  };

  return (
    <Modal title="Bulk Add Users" onClose={onCancel}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <textarea
          className="json-input"
          placeholder='[{"name": "Alice", "email": "alice@example.com"}]'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          required
        />
        {(formError || error) && <p className="error-box">{formError ?? error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-bulk" disabled={busy}>
            {busy ? "Adding..." : "Add Users"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ImportModalProps {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (file: File) => void;
}

function ImportModal({ busy, error, onCancel, onSubmit }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file) {
      onSubmit(file);
    }
  };

  return (
    <Modal title="Import Users from CSV" onClose={onCancel}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        {error && <p className="error-box">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-import" disabled={busy || !file}>
            {busy ? "Importing..." : "Import"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function IndexPage() {
  const [enabled, setEnabled] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled,
  });

  const busy = busyMessage !== null;

  const openModal = (state: ModalState) => {
    setActionError(null);
    setModal(state);
  };

  const handleFetchClick = () => {
    if (enabled) {
      refetch();
    } else {
      setEnabled(true);
    }
  };

  const runAction = async (message: string, action: () => Promise<void>) => {
    setBusyMessage(message);
    setActionError(null);
    try {
      await action();
      setEnabled(true);
      await refetch();
      setModal(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyMessage(null);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    setSelectedIds((prev) =>
      prev.size === data.length ? new Set() : new Set(data.map((user) => user.id))
    );
  };

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Users</h1>

        <div className="toolbar">
          <button className="fetch-button" onClick={handleFetchClick} disabled={isLoading}>
            {isLoading ? "Fetching..." : "Fetch Users"}
          </button>
          <button className="btn-add" onClick={() => openModal({ type: "add" })}>
            Add
          </button>
          <button className="btn-bulk" onClick={() => openModal({ type: "bulkAdd" })}>
            Bulk Add
          </button>
          <button className="btn-import" onClick={() => openModal({ type: "import" })}>
            Import
          </button>
          <button className="secondary-button" onClick={() => (window.location.href = getExportUrl())}>
            Export
          </button>
        </div>

        {isLoading && <p className="status-text">Loading...</p>}
        {isError && <p className="error-box">Something went wrong while fetching users.</p>}
        {data && data.length === 0 && <p className="status-text">No users found.</p>}

        {data && data.length > 0 && (
          <>
            <div className="toolbar toolbar-secondary">
              <button
                className="danger-button"
                onClick={() => openModal({ type: "confirmBulkDelete" })}
                disabled={selectedIds.size === 0}
              >
                Delete Selected ({selectedIds.size})
              </button>
            </div>

            <table className="user-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created At</th>
                  <th>Updated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelected(user.id)}
                      />
                    </td>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>{formatDate(user.updated_at)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Edit user"
                        onClick={() => openModal({ type: "edit", user })}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label="Delete user"
                        onClick={() => openModal({ type: "confirmDelete", id: user.id, name: user.name })}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {modal?.type === "add" && (
        <UserFormModal
          title="Add User"
          initial={{ name: "", email: "" }}
          busy={busy}
          error={actionError}
          submitClassName="btn-add"
          onCancel={() => setModal(null)}
          onSubmit={(input) =>
            runAction("Creating user...", async () => {
              await createUser(input);
            })
          }
        />
      )}

      {modal?.type === "edit" && (
        <UserFormModal
          title="Edit User"
          initial={{ name: modal.user.name, email: modal.user.email }}
          busy={busy}
          error={actionError}
          submitClassName="fetch-button"
          onCancel={() => setModal(null)}
          onSubmit={(input) =>
            runAction("Saving changes...", async () => {
              await updateUser(modal.user.id, input);
            })
          }
        />
      )}

      {modal?.type === "bulkAdd" && (
        <BulkAddModal
          busy={busy}
          error={actionError}
          onCancel={() => setModal(null)}
          onSubmit={(users) =>
            runAction("Bulk creating users...", async () => {
              await bulkCreateUsers(users);
            })
          }
        />
      )}

      {modal?.type === "import" && (
        <ImportModal
          busy={busy}
          error={actionError}
          onCancel={() => setModal(null)}
          onSubmit={(file) =>
            runAction("Importing CSV...", async () => {
              await importUsersCsv(file);
            })
          }
        />
      )}

      {modal?.type === "confirmDelete" && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete ${modal.name}?`}
          busy={busy}
          error={actionError}
          onCancel={() => setModal(null)}
          onConfirm={() =>
            runAction("Deleting user...", async () => {
              const id = modal.id;
              await deleteUser(id);
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            })
          }
        />
      )}

      {modal?.type === "confirmBulkDelete" && (
        <ConfirmModal
          title="Delete Selected Users"
          message={`Are you sure you want to delete ${selectedIds.size} selected user(s)?`}
          busy={busy}
          error={actionError}
          onCancel={() => setModal(null)}
          onConfirm={() =>
            runAction("Deleting selected users...", async () => {
              await bulkDeleteUsers(Array.from(selectedIds));
              setSelectedIds(new Set());
            })
          }
        />
      )}
    </div>
  );
}
