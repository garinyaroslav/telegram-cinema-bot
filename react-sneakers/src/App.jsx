import React from "react";
import { Route, Routes } from "react-router-dom";
import axios from "axios";
import Header from "./components/Header";
import Drawer from "./components/Drawer";
import NoMatch from "./components/NoMatch";

import Home from "./pages/Home";
import Favorites from "./pages/Favorites";

function App() {
  const [items, setItems] = React.useState([]);
  const [cartItems, setCartItems] = React.useState([]);
  const [favorites, setFavorites] = React.useState([]);
  const [searchValue, setSearchValue] = React.useState("");
  const [cartOpened, setCartOpened] = React.useState(false);

  React.useEffect(() => {
    axios.get("https://64a4071ec3b509573b56f14a.mockapi.io/items")
      .then(response => setItems(response.data));
    // axios.get("https://64a4071ec3b509573b56f14a.mockapi.io/cart")
    //   .then(response => setCartItems(response.data));
    axios.get("https://64a4071ec3b509573b56f14a.mockapi.io/favorites")
      .then(response => setFavorites(response.data));
  }, []);

  const onAddToCard = (obj) => {
    // axios.post("https://64a4071ec3b509573b56f14a.mockapi.io/cart", obj);
    setCartItems(prev => [...prev, obj]);
  };

  const onRemoveItem = (id) => {
    axios.delete(`https://64a4071ec3b509573b56f14a.mockapi.io/cart/${id}`);
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const onAddToFavorite = async (obj) => {
    try {
      console.log(obj);
    if (favorites.find(favObj => favObj.id === obj.id)) {
      axios.delete(`https://64a4071ec3b509573b56f14a.mockapi.io/favorites/${obj.id}`);
    } else {
      const { data } = await axios.post("https://64a4071ec3b509573b56f14a.mockapi.io/favorites", obj);
      setFavorites(prev => [...prev, data]);
    }
    } catch(error) {
      alert("Не удалост добавить в фавориты");
    }
  };

  const onChangeSearchInput = (event) => {
    setSearchValue(event.target.value);
  }

  return (
    <div className="wrapper clear">
      {cartOpened && <Drawer items={cartItems} onClose={() => setCartOpened(false)} onRemove={onRemoveItem} />}
      <Header onClickCart={() => setCartOpened(true)} />

      <Routes>
        <Route path="/" element={
          <Home
            items={items}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            onChangeSearchInput={onChangeSearchInput}
            onAddToFavorite={onAddToFavorite}
            onAddToCard={onAddToCard}
          />
        } />
        <Route path="/favorites" element={
          <Favorites items={favorites} onAddToFavorite={onAddToFavorite} />
        } />
        <Route path="*" element={<NoMatch />} />
      </Routes>

    </div>
  );
}

export default App;
