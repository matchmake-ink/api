class Team:
    def __init__(self, name, rating, rating_score, volatility):
        self.name = name
        self.rating = rating
        self.rating_score = rating_score
        self.volatility = volatility

    def __str__(self):
        return f"{self.name}: \n Rating - {self.rating} \n Rating Score - {self.rating_score} \n Volatility - {self.volatility} \n"