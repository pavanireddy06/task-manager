import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "https://task-manager-production-d56d.up.railway.app";

export default function Register() {
  const [form, setForm] = useState({});
  const navigate = useNavigate();

  const register = async () => {
    await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(form)
    });

    alert("Registered!");
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow w-80">
        <h2 className="text-xl font-bold mb-4">Register</h2>

        <input placeholder="Name" className="w-full mb-2 p-2 border"
          onChange={(e)=>setForm({...form,name:e.target.value})}/>

        <input placeholder="Email" className="w-full mb-2 p-2 border"
          onChange={(e)=>setForm({...form,email:e.target.value})}/>

        <input type="password" placeholder="Password"
          className="w-full mb-4 p-2 border"
          onChange={(e)=>setForm({...form,password:e.target.value})}/>

        <button onClick={register}
          className="w-full bg-green-600 text-white p-2">
          Register
        </button>
      </div>
    </div>
  );
}