import React from "react";

import styles from "./Card.module.scss";

function Card({ id, title, imageUrl, onFavorite, price, onPlus, favorited = false }) {
	const [isAdded, setIsAdded] = React.useState(false);
	const [isFavorite, setIsFavorite] = React.useState(favorited);

	const onClickPlus = () => {
		setIsAdded(!isAdded);
		onPlus({ title, imageUrl, price });
	};

	const onClickFavorite = () => {
		setIsFavorite(!isFavorite);
		onFavorite({ id, title, imageUrl, price });
	};

	return (
		<div className={styles.card}>
			<div className={styles.favorite} onClick={onClickFavorite}>
				<img src={isFavorite ? "/img/liked.svg" : "/img/unliked.svg"} alt="Unliked" />
			</div>
			<img width={133} height={112} src={imageUrl} alt="sneakers" />
			<h5>{title}</h5>
			<div className="d-flex justify-between align-center">
				<div className="d-flex flex-column">
					<span>Цена:</span>
					<b>{price} руб.</b>
				</div>
				<img className={styles.plus} src={isAdded ? "/img/btn-checked.svg" : "/img/btn-plus.svg"} alt="Plus" onClick={onClickPlus} />
			</div>
		</div>
	)
}

export default Card;