import { useNavigate } from "react-router-dom";
import { useUser } from "../../global/UserProvider";

const Recovery = () => {
  const navigate = useNavigate();
  const user = useUser();

  if (user?.currentUser.user) {
    navigate("/profile");
  }

  return (
    <div className="flex flex-col">
      <label htmlFor="password">New Password</label>
      <input type="password" name="password" id="password" />
      <label htmlFor="password">Confirm Password</label>
      <input type="password" name="confirmPassword" id="confirmPassword" />
      <button>Submit</button>
    </div>
  );
};

export default Recovery;
