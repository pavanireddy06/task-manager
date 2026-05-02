import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API = "https://task-manager-production-d56d.up.railway.app";

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");
  const socket = io(API);

  const loadTasks = async () => {
    const res = await fetch(`${API}/api/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTasks(await res.json());
  };

  useEffect(() => {
    loadTasks();
    socket.emit("join", token);

    socket.on("taskUpdated", loadTasks);

    socket.on("notification", (data) => {
      setMessage(data.message);
      setTimeout(() => setMessage(""), 3000);
    });

    return () => socket.disconnect();
  }, []);

  const uploadFile = async () => {
    if (!file) return "";

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/api/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    return data.url;
  };

  const addTask = async () => {
    const fileUrl = await uploadFile();

    await fetch(`${API}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title, fileUrl })
    });

    setTitle("");
    setFile(null);
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/api/tasks/status/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
  };

  const columns = {
    todo: tasks.filter(t => t.status === "todo"),
    doing: tasks.filter(t => t.status === "doing"),
    done: tasks.filter(t => t.status === "done")
  };

  return (
    <div className="p-6">

      {/* Notification */}
      {message && (
        <div className="fixed top-5 right-5 bg-indigo-600 text-white p-3 rounded">
          {message}
        </div>
      )}

      <h1 className="text-xl mb-4">Trello Board</h1>

      {/* Add Task */}
      <input value={title} onChange={e=>setTitle(e.target.value)} />
      <input type="file" onChange={e=>setFile(e.target.files[0])} />
      <button onClick={addTask}>Add</button>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4 mt-6">

        {Object.entries(columns).map(([col, items]) => (
          <div key={col} className="bg-gray-200 p-3">

            <h3>{col}</h3>

            {items.map(task => (
              <div key={task._id} className="bg-white p-2 mt-2">

                {task.title}

                {task.fileUrl && (
                  <a href={task.fileUrl} target="_blank">
                    📎 File
                  </a>
                )}

                <select
                  onChange={(e)=>updateStatus(task._id, e.target.value)}
                >
                  <option value="todo">Todo</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>

              </div>
            ))}

          </div>
        ))}

      </div>
    </div>
  );
}